using Dapper;
using genisis_Hub.Data;
using genisis_Hub.Helpers;
using genisis_Hub.Services;
using Microsoft.AspNetCore.Mvc;

namespace genisis_Hub.Controllers
{
    [ApiController]
    [Route("api/health")]
    public class HealthController : ControllerBase
    {
        private readonly DbContext _db;
        private readonly AiFaceClient _ai;
        public HealthController(DbContext db, AiFaceClient ai) { _db = db; _ai = ai; }

        // GET api/health  -- is the database and the Python face engine reachable?
        [HttpGet]
        public async Task<IActionResult> Get()
        {
            bool dbOk;
            try
            {
                using var conn = _db.CreateConnection();
                dbOk = await conn.ExecuteScalarAsync<int>("SELECT 1") == 1;
            }
            catch { dbOk = false; }
            var aiOk = await _ai.IsHealthyAsync();
            var body = ApiResponse<object>.Ok(new { database = dbOk ? "ok" : "down", faceEngine = aiOk ? "ok" : "down" },
                dbOk && aiOk ? "All systems operational" : "Degraded");
            return dbOk ? Ok(body) : StatusCode(503, body);
        }
    }
}
