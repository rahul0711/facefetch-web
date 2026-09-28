namespace genisis_Hub.Models
{
    public class SearchMatch
    {
        public ulong    SearchMatchId   { get; set; }
        public ulong    SearchId        { get; set; }
        public ulong    PhotoId         { get; set; }
        public decimal  SimilarityScore { get; set; }
        public DateTime CreatedAt       { get; set; }

        // Joined
        public string?  ThumbnailPath   { get; set; }
        public string?  FilePath        { get; set; }
        public string?  OriginalFileName { get; set; }
    }
}
