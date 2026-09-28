using MySqlConnector;

namespace genisis_Hub.Data
{
    public class DbContext
    {
        private readonly string _connectionString;

        public DbContext(IConfiguration configuration)
        {
            var raw = configuration.GetConnectionString("DefaultConnection")
                ?? throw new InvalidOperationException("Connection string not found.");
            // AllowZeroDateTime=true makes MySqlConnector return MySqlDateTime
            // objects, which Dapper can't map to DateTime -- every query reading a
            // date column would throw. Zero dates are still handled safely by
            // ConvertZeroDateTime (they become DateTime.MinValue).
            var builder = new MySqlConnectionStringBuilder(raw)
            {
                AllowZeroDateTime = false,
                ConvertZeroDateTime = true,
            };
            _connectionString = builder.ConnectionString;
        }

        public MySqlConnection CreateConnection() => new MySqlConnection(_connectionString);
    }
}
