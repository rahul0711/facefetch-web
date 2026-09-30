using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;

namespace genisis_Hub.Services
{
    public record ProcessedImage(byte[] Compressed, byte[] Thumbnail, int Width, int Height);

    /// <summary>
    /// Compresses uploads and stores them on disk OUTSIDE wwwroot, so photos
    /// are only reachable through the authorised /api/photos/... endpoints.
    /// The database keeps the file name + a path relative to the storage root.
    /// </summary>
    public class ImageStorage
    {
        private readonly string _root;
        private readonly int _maxSide, _quality, _thumbSide;

        public ImageStorage(IConfiguration config, IWebHostEnvironment env)
        {
            var root = config["FileStorage:Root"] ?? "storage";
            _root = Path.IsPathRooted(root) ? root : Path.Combine(env.ContentRootPath, root);
            _maxSide   = int.TryParse(config["FileStorage:MaxSidePx"], out var m) ? m : 2560;
            _quality   = int.TryParse(config["FileStorage:JpegQuality"], out var q) ? q : 85;
            _thumbSide = int.TryParse(config["FileStorage:ThumbnailSidePx"], out var t) ? t : 480;
            Directory.CreateDirectory(_root);
        }

        /// <summary>
        /// One decode -> a compressed JPEG (EXIF rotation applied, longest side
        /// capped, metadata such as GPS stripped) and a small thumbnail.
        /// </summary>
        public async Task<ProcessedImage> ProcessAsync(Stream input, int? maxSide = null)
        {
            using var img = await Image.LoadAsync(input);
            img.Mutate(x => x.AutoOrient());
            img.Metadata.ExifProfile = null;
            img.Metadata.XmpProfile  = null;
            img.Metadata.IptcProfile = null;
            var cap = maxSide ?? _maxSide;
            if (Math.Max(img.Width, img.Height) > cap)
                img.Mutate(x => x.Resize(new ResizeOptions { Size = new Size(cap, cap), Mode = ResizeMode.Max }));
            // JPEG has no alpha: flatten transparent PNG/WebP onto white.
            img.Mutate(x => x.BackgroundColor(Color.White));

            using var full = new MemoryStream();
            await img.SaveAsJpegAsync(full, new JpegEncoder { Quality = _quality });

            // A photo already smaller than a thumbnail is its own thumbnail:
            // enlarging it would only make a bigger, blurrier file.
            if (Math.Max(img.Width, img.Height) <= _thumbSide)
                return new ProcessedImage(full.ToArray(), full.ToArray(), img.Width, img.Height);

            using var thumbImg = img.Clone(x => x.Resize(new ResizeOptions { Size = new Size(_thumbSide, _thumbSide), Mode = ResizeMode.Max }));
            using var thumb = new MemoryStream();
            await thumbImg.SaveAsJpegAsync(thumb, new JpegEncoder { Quality = 78 });

            return new ProcessedImage(full.ToArray(), thumb.ToArray(), img.Width, img.Height);
        }

        /// <summary>Writes bytes under the storage root; returns the relative path stored in the DB.</summary>
        public async Task<string> SaveAsync(string folder, string fileName, byte[] bytes)
        {
            var rel = Path.Combine(folder, fileName).Replace('\\', '/');
            var abs = Resolve(rel);
            Directory.CreateDirectory(Path.GetDirectoryName(abs)!);
            await File.WriteAllBytesAsync(abs, bytes);
            return rel;
        }

        /// <summary>Absolute path for a stored relative path (also accepts old absolute paths).</summary>
        public string Resolve(string storedPath)
        {
            if (Path.IsPathRooted(storedPath)) return storedPath;
            var full = Path.GetFullPath(Path.Combine(_root, storedPath));
            // never let a stored path escape the storage root
            if (!full.StartsWith(Path.GetFullPath(_root), StringComparison.Ordinal))
                throw new InvalidOperationException("Invalid storage path");
            return full;
        }

        public bool Exists(string? storedPath) => !string.IsNullOrEmpty(storedPath) && File.Exists(Resolve(storedPath));

        /// <summary>Removes a storage sub-folder (e.g. photos/12) once it's empty.</summary>
        public void DeleteFolderIfEmpty(string relativeFolder)
        {
            try
            {
                var abs = Resolve(relativeFolder);
                if (Directory.Exists(abs) && !Directory.EnumerateFileSystemEntries(abs).Any()) Directory.Delete(abs);
            }
            catch (IOException) { /* best effort */ }
        }

        public void Delete(string? storedPath)
        {
            if (string.IsNullOrEmpty(storedPath)) return;
            try
            {
                var abs = Resolve(storedPath);
                if (File.Exists(abs)) File.Delete(abs);
            }
            catch (IOException) { /* best effort */ }
        }
    }
}
