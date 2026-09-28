using Dapper;
using genisis_Hub.Data;
using genisis_Hub.Models;

namespace genisis_Hub.Services
{
    public interface IFaceService
    {
        /// <summary>Replaces all faces of a photo (used on upload and re-analyse).</summary>
        Task<int> ReplaceFacesAsync(ulong photoId, uint imgWidth, uint imgHeight, IReadOnlyList<AiFace> faces);
        Task<List<Face>> GetFacesByPhotoAsync(ulong photoId);
        Task<List<Face>> GetFacesByEventAsync(ulong eventId);
    }

    public class FaceService : IFaceService
    {
        private readonly DbContext _db;
        public FaceService(DbContext db) => _db = db;

        public async Task<int> ReplaceFacesAsync(ulong photoId, uint imgWidth, uint imgHeight, IReadOnlyList<AiFace> faces)
        {
            using var conn = _db.CreateConnection();
            await conn.OpenAsync();
            using var tx = await conn.BeginTransactionAsync();
            await conn.ExecuteAsync("DELETE FROM faces WHERE photo_id=@PhotoId", new { PhotoId = photoId }, tx);

            var rows = new List<object>();
            for (var i = 0; i < faces.Count; i++)
            {
                var f = faces[i];
                var emb = AiFaceClient.DecodeEmbeddingBytes(f.Embedding);
                if (emb is null || f.Box.Length != 4) continue;
                // AI boxes are fractions of the analysed image -> pixels of the stored image.
                int x1 = (int)Math.Round(Math.Clamp(f.Box[0], 0f, 1f) * imgWidth);
                int y1 = (int)Math.Round(Math.Clamp(f.Box[1], 0f, 1f) * imgHeight);
                int x2 = (int)Math.Round(Math.Clamp(f.Box[2], 0f, 1f) * imgWidth);
                int y2 = (int)Math.Round(Math.Clamp(f.Box[3], 0f, 1f) * imgHeight);
                rows.Add(new
                {
                    PhotoId = photoId,
                    FaceIndex = rows.Count,
                    X = x1, Y = y1,
                    Width = (uint)Math.Max(1, x2 - x1),
                    Height = (uint)Math.Max(1, y2 - y1),
                    Confidence = Math.Round((decimal)Math.Clamp(f.Score, 0f, 1f), 5),
                    Embedding = emb,
                });
            }
            if (rows.Count > 0)
            {
                await conn.ExecuteAsync(@"
                    INSERT INTO faces (photo_id, face_index, x, y, width, height, detection_confidence, embedding)
                    VALUES (@PhotoId, @FaceIndex, @X, @Y, @Width, @Height, @Confidence, @Embedding)", rows, tx);
            }
            await tx.CommitAsync();
            return rows.Count;
        }

        public async Task<List<Face>> GetFacesByPhotoAsync(ulong photoId)
        {
            using var conn = _db.CreateConnection();
            return (await conn.QueryAsync<Face>(
                "SELECT * FROM faces WHERE photo_id=@PhotoId ORDER BY face_index",
                new { PhotoId = photoId })).ToList();
        }

        /// <summary>All embeddings of an event's analysed photos (for matching).</summary>
        public async Task<List<Face>> GetFacesByEventAsync(ulong eventId)
        {
            using var conn = _db.CreateConnection();
            const string sql = @"SELECT f.*
                                 FROM faces f
                                 JOIN photos p ON f.photo_id = p.photo_id
                                 WHERE p.event_id = @EventId AND p.status = 'Completed'";
            return (await conn.QueryAsync<Face>(sql, new { EventId = eventId })).ToList();
        }
    }
}
