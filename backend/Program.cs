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
var dbPath = Path.Combine(AppContext.BaseDirectory, "Bookstore.sqlite");
var connectionString = $"Data Source={dbPath}";

// Enable the CORS policy defined above
app.UseCors("AllowFrontend");

// Returns distinct book categories for the category filter dropdown.
app.MapGet("/api/books/categories", () =>
{
    using var connection = new SqliteConnection(connectionString);
    connection.Open();

    using var categoryCommand = connection.CreateCommand();
    categoryCommand.CommandText = @"
        SELECT DISTINCT Classification
        FROM Books
        WHERE Classification IS NOT NULL AND TRIM(Classification) <> ''
        ORDER BY Classification;";

    var categories = new List<string>();
    using var reader = categoryCommand.ExecuteReader();
    while (reader.Read())
    {
        categories.Add(reader.GetString(0));
    }

    return Results.Ok(categories);
});

// Simple API endpoint that reads books from the SQLite database
// and returns a single page of results sorted by title.
app.MapGet("/api/books", (int? page, int? pageSize, string? sortDir, string? category) =>
{
    using var connection = new SqliteConnection(connectionString);
    connection.Open();

    var hasCategoryFilter = !string.IsNullOrWhiteSpace(category);

    // Get the total number of books so the frontend can calculate total pages.
    // If category is selected, only count books in that category.
    using var countCommand = connection.CreateCommand();
    countCommand.CommandText = hasCategoryFilter
        ? "SELECT COUNT(*) FROM Books WHERE Classification = $category;"
        : "SELECT COUNT(*) FROM Books;";
    if (hasCategoryFilter)
    {
        countCommand.Parameters.AddWithValue("$category", category);
    }
    var totalCount = Convert.ToInt32(countCommand.ExecuteScalar());

    // Sanitize sort direction coming from the query string
    var sortDirection = string.Equals(sortDir, "desc", StringComparison.OrdinalIgnoreCase)
        ? "DESC"
        : "ASC";

    // Basic guard rails for paging inputs
    var currentPageSize = pageSize.GetValueOrDefault(5);
    var currentPage = page.GetValueOrDefault(1);
    var limit = currentPageSize <= 0 ? 5 : currentPageSize;
    var offset = (currentPage <= 0 ? 0 : (currentPage - 1) * limit);

    // Pull back only a single page of books, optionally filtered by category.
    using var dataCommand = connection.CreateCommand();
    var whereClause = hasCategoryFilter ? "WHERE Classification = $category" : string.Empty;
    dataCommand.CommandText = $@"
        SELECT BookID,
               Title,
               Author,
               Publisher,
               ISBN,
               Classification,
               Category,
               PageCount,
               Price
        FROM Books
        {whereClause}
        ORDER BY Title {sortDirection}
        LIMIT $limit OFFSET $offset;";

    dataCommand.Parameters.AddWithValue("$limit", limit);
    dataCommand.Parameters.AddWithValue("$offset", offset);
    if (hasCategoryFilter)
    {
        dataCommand.Parameters.AddWithValue("$category", category);
    }

    var books = new List<BookDto>();

    using var reader = dataCommand.ExecuteReader();
    while (reader.Read())
    {
        // Map each row from the database into our BookDto model
        var book = new BookDto
    {
        BookId = reader.IsDBNull(0) ? 0 : reader.GetInt32(0),
        Title = reader.IsDBNull(1) ? "" : reader.GetString(1),
        Author = reader.IsDBNull(2) ? "" : reader.GetString(2),
        Publisher = reader.IsDBNull(3) ? "" : reader.GetString(3),
        Isbn = reader.IsDBNull(4) ? "" : reader.GetString(4),
        Classification = reader.IsDBNull(5) ? "" : reader.GetString(5),
        Category = reader.IsDBNull(6) ? "" : reader.GetString(6),
        PageCount = reader.IsDBNull(7) ? 0 : reader.GetInt32(7),
        Price = reader.IsDBNull(8) ? 0 : Convert.ToDecimal(reader.GetDouble(8))
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

app.MapPost("/api/books", (BookDto newBook) =>
{
    var validationError = ValidateBook(newBook);
    if (validationError is not null)
    {
        return Results.BadRequest(validationError);
    }

    using var connection = new SqliteConnection(connectionString);
    connection.Open();

    using var command = connection.CreateCommand();
    command.CommandText = @"
        INSERT INTO Books (Title, Author, Publisher, ISBN, Classification, Category, PageCount, Price)
        VALUES ($title, $author, $publisher, $isbn, $classification, $category, $pageCount, $price);
        SELECT last_insert_rowid();";
    command.Parameters.AddWithValue("$title", newBook.Title.Trim());
    command.Parameters.AddWithValue("$author", newBook.Author.Trim());
    command.Parameters.AddWithValue("$publisher", newBook.Publisher.Trim());
    command.Parameters.AddWithValue("$isbn", newBook.Isbn.Trim());
    command.Parameters.AddWithValue("$classification", newBook.Classification.Trim());
    command.Parameters.AddWithValue("$category", newBook.Category.Trim());
    command.Parameters.AddWithValue("$pageCount", newBook.PageCount);
    command.Parameters.AddWithValue("$price", newBook.Price);

    var id = Convert.ToInt32(command.ExecuteScalar());
    newBook.BookId = id;
    return Results.Created($"/api/books/{id}", newBook);
});

app.MapPut("/api/books/{id:int}", (int id, BookDto updatedBook) =>
{
    var validationError = ValidateBook(updatedBook);
    if (validationError is not null)
    {
        return Results.BadRequest(validationError);
    }

    using var connection = new SqliteConnection(connectionString);
    connection.Open();

    using var command = connection.CreateCommand();
    command.CommandText = @"
        UPDATE Books
        SET Title = $title,
            Author = $author,
            Publisher = $publisher,
            ISBN = $isbn,
            Classification = $classification,
            Category = $category,
            PageCount = $pageCount,
            Price = $price
        WHERE BookID = $id;";
    command.Parameters.AddWithValue("$id", id);
    command.Parameters.AddWithValue("$title", updatedBook.Title.Trim());
    command.Parameters.AddWithValue("$author", updatedBook.Author.Trim());
    command.Parameters.AddWithValue("$publisher", updatedBook.Publisher.Trim());
    command.Parameters.AddWithValue("$isbn", updatedBook.Isbn.Trim());
    command.Parameters.AddWithValue("$classification", updatedBook.Classification.Trim());
    command.Parameters.AddWithValue("$category", updatedBook.Category.Trim());
    command.Parameters.AddWithValue("$pageCount", updatedBook.PageCount);
    command.Parameters.AddWithValue("$price", updatedBook.Price);

    var rowsUpdated = command.ExecuteNonQuery();
    if (rowsUpdated == 0)
    {
        return Results.NotFound();
    }

    updatedBook.BookId = id;
    return Results.Ok(updatedBook);
});

app.MapDelete("/api/books/{id:int}", (int id) =>
{
    using var connection = new SqliteConnection(connectionString);
    connection.Open();

    using var command = connection.CreateCommand();
    command.CommandText = "DELETE FROM Books WHERE BookID = $id;";
    command.Parameters.AddWithValue("$id", id);

    var rowsDeleted = command.ExecuteNonQuery();
    return rowsDeleted == 0 ? Results.NotFound() : Results.NoContent();
});
app.MapGet("/", () => "Book API is running");
app.Run();

static string? ValidateBook(BookDto book)
{
    if (string.IsNullOrWhiteSpace(book.Title) ||
        string.IsNullOrWhiteSpace(book.Author) ||
        string.IsNullOrWhiteSpace(book.Publisher) ||
        string.IsNullOrWhiteSpace(book.Isbn) ||
        string.IsNullOrWhiteSpace(book.Classification) ||
        string.IsNullOrWhiteSpace(book.Category))
    {
        return "Title, Author, Publisher, ISBN, Classification, and Category are required.";
    }

    if (book.PageCount <= 0)
    {
        return "PageCount must be greater than zero.";
    }

    if (book.Price < 0)
    {
        return "Price must be zero or greater.";
    }

    return null;
}
