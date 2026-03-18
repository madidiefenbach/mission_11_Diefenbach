using Microsoft.Data.Sqlite;
using backend.Models;

// Configure the web application and services
var builder = WebApplication.CreateBuilder(args);

// Allow the React frontend (running on a different port) to call this API
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// Enable the CORS policy defined above
app.UseCors("AllowFrontend");

// Simple API endpoint that reads books from the SQLite database
// and returns a single page of results sorted by title.
app.MapGet("/api/books", (int page, int pageSize, string sortDir) =>
{
    // Path to the Bookstore.sqlite database file, now kept inside this solution folder
    // so the whole mission_11 project is self-contained.
    var connectionString = "Data Source=C:\\Users\\madid\\OneDrive\\Desktop\\is 413\\mission_11\\Bookstore.sqlite";

    using var connection = new SqliteConnection(connectionString);
    connection.Open();

    // Get the total number of books so the frontend can calculate total pages
    using var countCommand = connection.CreateCommand();
    countCommand.CommandText = "SELECT COUNT(*) FROM Books;";
    var totalCount = Convert.ToInt32(countCommand.ExecuteScalar());

    // Sanitize sort direction coming from the query string
    var sortDirection = string.Equals(sortDir, "desc", StringComparison.OrdinalIgnoreCase)
        ? "DESC"
        : "ASC";

    // Basic guard rails for paging inputs
    var limit = pageSize <= 0 ? 5 : pageSize;
    var offset = (page <= 0 ? 0 : (page - 1) * limit);

    // Pull back only a single page of books, ordered by title
    using var dataCommand = connection.CreateCommand();
    dataCommand.CommandText = $@"
        SELECT Title,
               Author,
               Publisher,
               ISBN,
               Classification,
               PageCount,
               Price
        FROM Books
        ORDER BY Title {sortDirection}
        LIMIT $limit OFFSET $offset;";

    dataCommand.Parameters.AddWithValue("$limit", limit);
    dataCommand.Parameters.AddWithValue("$offset", offset);

    var books = new List<BookDto>();

    using var reader = dataCommand.ExecuteReader();
    while (reader.Read())
    {
        // Map each row from the database into our BookDto model
        var book = new BookDto
        {
            Title = reader.GetString(0),
            Author = reader.GetString(1),
            Publisher = reader.GetString(2),
            Isbn = reader.GetString(3),
            Classification = reader.GetString(4),
            PageCount = reader.GetInt32(5),
            Price = reader.GetDecimal(6)
        };

        books.Add(book);
    }

    // Wrap the books plus the total count so the frontend
    // can render both the current page and the pager UI
    var result = new
    {
        items = books,
        totalCount
    };

    return Results.Ok(result);
});

app.Run();
