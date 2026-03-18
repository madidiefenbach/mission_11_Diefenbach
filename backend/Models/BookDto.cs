namespace backend.Models;

// Simple data-transfer object that mirrors the columns
// in the Books table inside Bookstore.sqlite.
public class BookDto
{
    public string Title { get; set; } = null!;
    public string Author { get; set; } = null!;
    public string Publisher { get; set; } = null!;
    public string Isbn { get; set; } = null!;
    public string Classification { get; set; } = null!;
    public int PageCount { get; set; }
    public decimal Price { get; set; }
}

