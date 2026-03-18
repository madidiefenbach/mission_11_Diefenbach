import React, { useEffect, useMemo, useState } from 'react'
import './App.css'

// Shape of a single book coming back from the API.
// This should stay in sync with BookDto on the backend.
type Book = {
  title: string
  author: string
  publisher: string
  isbn: string
  classification: string
  pageCount: number
  price: number
}

// Overall shape of the paged response from /api/books
type BooksResponse = {
  items: Book[]
  totalCount: number
}

const App: React.FC = () => {
  // Books for the current page
  const [books, setBooks] = useState<Book[]>([])
  // Total number of books in the database
  const [totalCount, setTotalCount] = useState(0)
  // Current page number (1-based)
  const [page, setPage] = useState(1)
  // How many results to show per page
  const [pageSize, setPageSize] = useState(5)
  // Whether we are sorting title ascending or descending
  const [sortAsc, setSortAsc] = useState(true)
  // Basic loading and error state for the fetch
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Recalculate total pages any time the total count or page size changes
  const totalPages = useMemo(
    () => (totalCount === 0 ? 1 : Math.ceil(totalCount / pageSize)),
    [totalCount, pageSize],
  )

  // Whenever page, pageSize, or sortAsc changes, request a fresh page
  // of books from the backend API.
  useEffect(() => {
    const fetchBooks = async () => {
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          page: page.toString(),
          pageSize: pageSize.toString(),
          sortDir: sortAsc ? 'asc' : 'desc',
        })

        // Call into the ASP.NET Core backend API
        const response = await fetch(`http://localhost:5288/api/books?${params.toString()}`)
        if (!response.ok) {
          throw new Error(`Error fetching books: ${response.statusText}`)
        }

        const data: BooksResponse = await response.json()
        setBooks(data.items)
        setTotalCount(data.totalCount)
      } catch (err: any) {
        setError(err.message ?? 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchBooks()
  }, [page, pageSize, sortAsc])

  // Move to the requested page number, as long as it is in range
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return
    setPage(newPage)
  }

  // When the user changes the page size, reset back to page 1
  // and let the effect above refetch using the new size.
  const handlePageSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = Number(event.target.value)
    setPageSize(newSize)
    setPage(1)
  }

  // Toggle sort direction between ascending and descending title
  const handleSortClick = () => {
    setSortAsc((prev) => !prev)
    setPage(1)
  }

  return (
    <div className="container my-4">
      <h1 className="mb-3">Online Bookstore</h1>
      <p className="text-muted mb-4">Browse books from the bookstore database.</p>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <label className="me-2 fw-semibold" htmlFor="pageSizeSelect">
            Results per page:
          </label>
          <select
            id="pageSizeSelect"
            className="form-select d-inline-block w-auto"
            value={pageSize}
            onChange={handlePageSizeChange}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </div>
        <div>
          <span className="text-muted">
            Showing page {page} of {totalPages} ({totalCount} total books)
          </span>
        </div>
      </div>

      {loading && <div className="alert alert-info">Loading books...</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {!loading && !error && books.length === 0 && (
        <div className="alert alert-warning">No books found.</div>
      )}

      {!loading && !error && books.length > 0 && (
        <div className="table-responsive">
          <table className="table table-striped table-hover">
            <thead className="table-light">
              <tr>
                <th scope="col">
                  <button
                    type="button"
                    className="btn btn-link p-0 fw-semibold text-decoration-none"
                    onClick={handleSortClick}
                  >
                    Title
                    <span className="ms-1">{sortAsc ? <>&uarr;</> : <>&darr;</>}</span>
                  </button>
                </th>
                <th scope="col">Author</th>
                <th scope="col">Publisher</th>
                <th scope="col">ISBN</th>
                <th scope="col">Classification</th>
                <th scope="col" className="text-end">
                  Pages
                </th>
                <th scope="col" className="text-end">
                  Price
                </th>
              </tr>
            </thead>
            <tbody>
              {books.map((book, index) => (
                <tr key={`${book.isbn}-${index}`}>
                  <td>{book.title}</td>
                  <td>{book.author}</td>
                  <td>{book.publisher}</td>
                  <td>{book.isbn}</td>
                  <td>{book.classification}</td>
                  <td className="text-end">{book.pageCount}</td>
                  <td className="text-end">${book.price.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav aria-label="Books pagination" className="mt-3">
        <ul className="pagination justify-content-center">
          <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
            <button className="page-link" onClick={() => handlePageChange(page - 1)}>
              Previous
            </button>
          </li>
          {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNumber) => (
            <li
              key={pageNumber}
              className={`page-item ${pageNumber === page ? 'active' : ''}`}
            >
              <button className="page-link" onClick={() => handlePageChange(pageNumber)}>
                {pageNumber}
              </button>
            </li>
          ))}
          <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
            <button className="page-link" onClick={() => handlePageChange(page + 1)}>
              Next
            </button>
          </li>
        </ul>
      </nav>
    </div>
  )
}

export default App
