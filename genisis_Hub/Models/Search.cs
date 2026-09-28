namespace genisis_Hub.Models
{
    public class Search
    {
        public ulong    SearchId            { get; set; }
        public ulong    EventId             { get; set; }
        public ulong?   GuestId             { get; set; }
        public string   SearchStatus        { get; set; } = "Pending";
        public bool     FaceDetected        { get; set; } = false;
        public uint     MatchCount          { get; set; } = 0;
        public decimal  SimilarityThreshold { get; set; } = 0.35m;
        public DateTime StartedAt           { get; set; }
        public DateTime? CompletedAt        { get; set; }
        public string?  ErrorMessage        { get; set; }
        /// <summary>Name and email the visitor typed before searching (no account needed).</summary>
        public string?  VisitorName         { get; set; }
        public string?  VisitorEmail        { get; set; }

        // Joined
        public string?  EventName           { get; set; }
        public string?  GuestName           { get; set; }
    }
}
