namespace genisis_Hub.Helpers
{
    public static class CosineHelper
    {
        /// <summary>
        /// Compute cosine similarity between two float[512] embeddings.
        /// Returns value between -1 and 1. Threshold: >= 0.35 means same person.
        /// </summary>
        public static double Similarity(float[] a, float[] b)
        {
            if (a.Length != b.Length) return 0;
            double dot = 0, magA = 0, magB = 0;
            for (int i = 0; i < a.Length; i++)
            {
                dot  += a[i] * b[i];
                magA += a[i] * a[i];
                magB += b[i] * b[i];
            }
            if (magA == 0 || magB == 0) return 0;
            return dot / (Math.Sqrt(magA) * Math.Sqrt(magB));
        }

        /// <summary>Convert float[] embedding to byte[] for MySQL BLOB storage.</summary>
        public static byte[] ToBlob(float[] embedding)
        {
            var blob = new byte[embedding.Length * 4];
            Buffer.BlockCopy(embedding, 0, blob, 0, blob.Length);
            return blob;
        }

        /// <summary>Convert MySQL BLOB back to float[] embedding.</summary>
        public static float[] FromBlob(byte[] blob)
        {
            var embedding = new float[blob.Length / 4];
            Buffer.BlockCopy(blob, 0, embedding, 0, blob.Length);
            return embedding;
        }
    }
}
