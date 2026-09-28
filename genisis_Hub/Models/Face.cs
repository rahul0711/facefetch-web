namespace genisis_Hub.Models
{
    public class Face
    {
        public ulong    FaceId               { get; set; }
        public ulong    PhotoId              { get; set; }
        public int      FaceIndex            { get; set; }
        public int      X                    { get; set; }
        public int      Y                    { get; set; }
        public uint     Width                { get; set; }
        public uint     Height               { get; set; }
        public decimal? DetectionConfidence  { get; set; }
        public byte[]   Embedding            { get; set; } = Array.Empty<byte>();
        public DateTime CreatedAt            { get; set; }
    }
}
