using genisis_Hub.Data;
using genisis_Hub.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;

// Map snake_case columns (password_hash) to PascalCase properties (PasswordHash).
// Without this every "SELECT *" query returns empty fields -- login included.
Dapper.DefaultTypeMap.MatchNamesWithUnderscores = true;

var builder = WebApplication.CreateBuilder(args);

// ─── Controllers (API only — no views needed) ───────────────────────────────
builder.Services.AddControllers()
    .AddNewtonsoftJson(opt =>
        opt.SerializerSettings.ReferenceLoopHandling =
            Newtonsoft.Json.ReferenceLoopHandling.Ignore);

// ─── CORS (allow React dev server + production origin) ──────────────────────
builder.Services.AddCors(options =>
{
    // Extra origins (e.g. the production site) can be added under "Cors:Origins" in config.
    var origins = new[] { "http://localhost:5173", "https://localhost:5173", "http://localhost:3000" }
        .Concat(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? Array.Empty<string>())
        .Distinct().ToArray();
    options.AddPolicy("AllowFrontend", policy =>
        policy.WithOrigins(origins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials()
              .WithExposedHeaders("Content-Disposition"));
});

// ─── JWT Authentication ──────────────────────────────────────────────────────
var jwtKey = builder.Configuration["Jwt:SecretKey"]!;
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidateAudience         = true,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer              = builder.Configuration["Jwt:Issuer"],
            ValidAudience            = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
        // <img src> can't send an Authorization header, so photo image,
        // thumbnail and download URLs (and event covers) also accept ?access_token=<jwt>.
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var path = ctx.HttpContext.Request.Path;
                var token = ctx.Request.Query["access_token"].ToString();
                if (!string.IsNullOrEmpty(token) &&
                    (path.StartsWithSegments("/api/photos") || path.StartsWithSegments("/api/events")) &&
                    HttpMethods.IsGet(ctx.Request.Method))
                    ctx.Token = token;
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// ─── Swagger / OpenAPI ───────────────────────────────────────────────────────
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title   = "Genesis Hub Face Search API",
        Version = "v1",
        Description = "Backend for Genesis Hub — face-recognition photo retrieval platform"
    });
    // Add JWT Authorize button to Swagger UI
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name         = "Authorization",
        Type         = SecuritySchemeType.Http,
        Scheme       = "bearer",
        BearerFormat = "JWT",
        In           = ParameterLocation.Header,
        Description  = "Enter your JWT token (without 'Bearer' prefix)"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

// ─── Data / DB ───────────────────────────────────────────────────────────────
builder.Services.AddSingleton<DbContext>();

// ─── Application Services ─────────────────────────────────────────────────
builder.Services.AddScoped<IAuthService,        AuthService>();
builder.Services.AddScoped<IEventService,       EventService>();
builder.Services.AddScoped<IPhotoService,       PhotoService>();
builder.Services.AddScoped<IFaceService,        FaceService>();
builder.Services.AddScoped<ISearchService,      SearchService>();
builder.Services.AddScoped<IDownloadService,    DownloadService>();
builder.Services.AddScoped<ActivityLogService>();
builder.Services.AddScoped<SettingsService>();
builder.Services.AddScoped<AccessService>();
builder.Services.AddScoped<AnalyticsService>();
builder.Services.AddSingleton<ImageStorage>();

// ─── AI Bridge (Python FastAPI) ──────────────────────────────────────────────
builder.Services.AddHttpClient<AiFaceClient>(client =>
{
    client.BaseAddress = new Uri(builder.Configuration["AiServer:BaseUrl"]!);
    client.Timeout     = TimeSpan.FromSeconds(60);
}).ConfigurePrimaryHttpMessageHandler(() =>
{
    var handler = new HttpClientHandler();
    // The Python server uses a self-signed certificate on the LAN; only
    // skip certificate checks when AiServer:IgnoreSslErrors is true.
    if (builder.Configuration.GetValue<bool>("AiServer:IgnoreSslErrors"))
        handler.ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator;
    return handler;
});

// Google Drive imports (public "Anyone with the link" folders, Drive API key).
builder.Services.AddHttpClient<GoogleDriveService>(client => client.Timeout = TimeSpan.FromSeconds(120));

// ─── Multipart limit for photo uploads ──────────────────────────────────────
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(opt =>
{
    opt.MultipartBodyLengthLimit = 500 * 1024 * 1024; // 500 MB
});

// ─── Build & Pipeline ────────────────────────────────────────────────────────
var app = builder.Build();

// Avatars are public (wwwroot). Event photos live in FileStorage:Root (default
// ./storage), outside wwwroot, and are only served by /api/photos/... with auth.
Directory.CreateDirectory(Path.Combine(app.Environment.ContentRootPath, "wwwroot", "uploads", "avatars"));

// First-run: create the first SuperAdmin from Bootstrap:* settings, if configured.
using (var scope = app.Services.CreateScope())
{
    try
    {
        await scope.ServiceProvider.GetRequiredService<IAuthService>()
            .EnsureSuperAdminAsync(app.Configuration, app.Logger);
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "SuperAdmin bootstrap skipped (database unreachable?)");
    }
}

// Swagger always available (even in prod — restrict in production if needed)
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Genesis Hub API v1");
    c.RoutePrefix = "swagger";
    c.DocumentTitle = "Genesis Hub API";
});

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

// Production (port 9006 behind nginx): the backend also serves the built React
// app, so the whole site is one origin and nginx proxies a single port.
// Enabled only when Frontend:DistPath points at frontend/dist. Registered
// before routing: static files are skipped once an endpoint has matched.
var distPath = app.Configuration["Frontend:DistPath"];
var distRoot = !string.IsNullOrWhiteSpace(distPath) && Directory.Exists(distPath) ? Path.GetFullPath(distPath) : null;
if (distRoot != null)
{
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(distRoot),
        OnPrepareResponse = ctx =>
        {
            // Vite fingerprints everything under /assets, so those never change.
            if (ctx.Context.Request.Path.StartsWithSegments("/assets"))
                ctx.Context.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
        },
    });
}

app.UseCors("AllowFrontend");
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Production (port 9006 behind nginx): client-side routes (/events, /admin/...)
// get index.html; unknown API paths stay 404. See Frontend:DistPath above.
if (distRoot != null)
{
    app.MapFallback(async context =>
    {
        if (context.Request.Path.StartsWithSegments("/api"))
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }
        context.Response.Headers.CacheControl = "no-cache";
        context.Response.ContentType = "text/html; charset=utf-8";
        await context.Response.SendFileAsync(Path.Combine(distRoot, "index.html"));
    });
}

app.Run();
