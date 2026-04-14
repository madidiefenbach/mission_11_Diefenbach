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

type CartItem = {
  book: Book
  quantity: number
}

type ViewMode = 'shopping' | 'cart'

const CART_STORAGE_KEY = 'mission11-cart'
const BROWSE_STATE_STORAGE_KEY = 'mission11-browse-state'
const PRODUCTION_API_ORIGIN =
  'https://mission12diefenbach-cjdzbuerf0ehdcas.canadacentral-01.azurewebsites.net'
const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')
const API_BASE =
  configuredApiBase ??
  (import.meta.env.DEV
    ? 'http://localhost:5288'
    : window.location.hostname.includes('canadacentral-01.azurewebsites.net')
      ? ''
      : PRODUCTION_API_ORIGIN)

const App: React.FC = () => {
  // Books for the current page
  const [books, setBooks] = useState<Book[]>([])
  // Available categories used for the filter dropdown
  const [categories, setCategories] = useState<string[]>([])
  // Currently selected category; empty means "All Categories"
  const [selectedCategory, setSelectedCategory] = useState('')
  // Total number of books in the database
  const [totalCount, setTotalCount] = useState(0)
  // Current page number (1-based)
  const [page, setPage] = useState(1)
  // How many results to show per page
  const [pageSize, setPageSize] = useState(5)
  // Whether we are sorting title ascending or descending
  const [sortAsc, setSortAsc] = useState(true)
  // Cart state persisted for the browser session
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  // Toggle between shopping list and cart views
  const [viewMode, setViewMode] = useState<ViewMode>('shopping')
  // Basic loading and error state for the fetch
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Recalculate total pages any time the total count or page size changes
  const totalPages = useMemo(
    () => (totalCount === 0 ? 1 : Math.ceil(totalCount / pageSize)),
    [totalCount, pageSize],
  )

  // Total number of items in cart (sums quantities for all line items).
  const cartItemCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems],
  )

  // Cart grand total (sum of price * quantity for each line item).
  const cartTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.book.price * item.quantity, 0),
    [cartItems],
  )

  // Progress-bar value showing how much of the catalog has been added
  // to cart (based on quantity vs total book count).
  const cartFillPercent = useMemo(() => {
    if (totalCount <= 0) return 0
    return Math.min(100, Math.round((cartItemCount / totalCount) * 100))
  }, [cartItemCount, totalCount])

  // Restore cart and browsing state (page, filters, sort) for this session.
  useEffect(() => {
    const cartJson = sessionStorage.getItem(CART_STORAGE_KEY)
    if (cartJson) {
      try {
        const parsed = JSON.parse(cartJson) as CartItem[]
        setCartItems(parsed)
      } catch {
        setCartItems([])
      }
    }

    const browseJson = sessionStorage.getItem(BROWSE_STATE_STORAGE_KEY)
    if (browseJson) {
      try {
        const parsed = JSON.parse(browseJson) as {
          page: number
          pageSize: number
          sortAsc: boolean
          selectedCategory: string
        }
        setPage(parsed.page)
        setPageSize(parsed.pageSize)
        setSortAsc(parsed.sortAsc)
        setSelectedCategory(parsed.selectedCategory)
      } catch {
        // Keep defaults if stored state cannot be parsed.
      }
    }
  }, [])

  // Persist cart changes for the duration of this browser session.
  useEffect(() => {
    sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems))
  }, [cartItems])

  // Persist browsing state so "Continue Shopping" can return users
  // to where they left off after viewing cart.
  useEffect(() => {
    sessionStorage.setItem(
      BROWSE_STATE_STORAGE_KEY,
      JSON.stringify({ page, pageSize, sortAsc, selectedCategory }),
    )
  }, [page, pageSize, sortAsc, selectedCategory])

  // Load distinct categories once when the component is first mounted.
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/books/categories`)
        if (!response.ok) {
          throw new Error(`Error fetching categories: ${response.statusText}`)
        }

        const data: string[] = await response.json()
        setCategories(data)
      } catch {
        // Keep the UI usable even if categories fail to load.
        setCategories([])
      }
    }

    // Populate category dropdown options.
    fetchCategories()
  }, [])

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
        if (selectedCategory) {
          params.append('category', selectedCategory)
        }

        // Call into the ASP.NET Core backend API
        const response = await fetch(`${API_BASE}/api/books?${params.toString()}`)
        if (!response.ok) {
          throw new Error(`Error fetching books: ${response.statusText}`)
        }

        // API returns a paged payload: { items, totalCount }.
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
  }, [page, pageSize, sortAsc, selectedCategory])

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

  // Changing category should reset to page 1 and fetch filtered books.
  const handleCategoryChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCategory(event.target.value)
    setPage(1)
  }

  // Adds a book to cart, or increments quantity if already present.
  const addToCart = (book: Book) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.book.isbn === book.isbn)
      if (existing) {
        return prev.map((item) =>
          item.book.isbn === book.isbn ? { ...item, quantity: item.quantity + 1 } : item,
        )
      }
      return [...prev, { book, quantity: 1 }]
    })
  }

  // Updates quantity for a line item. If quantity becomes 0 or less,
  // that item is removed from the cart.
  const updateCartQuantity = (isbn: string, quantity: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => (item.book.isbn === isbn ? { ...item, quantity } : item))
        .filter((item) => item.quantity > 0),
    )
  }

  // Explicit remove action from the cart page.
  const removeFromCart = (isbn: string) => {
    setCartItems((prev) => prev.filter((item) => item.book.isbn !== isbn))
  }

  // Returns from cart view to shopping list while keeping browse state.
  const continueShopping = () => {
    setViewMode('shopping')
  }

  return (
    <>
      {/* Bootstrap Navbar: sticky header + cart badge (always visible) */}
      <nav
        className="navbar navbar-expand-lg navbar-dark bg-dark position-sticky top-0 shadow-sm"
        aria-label="Top navigation"
      >
        <div className="container">
          <span className="navbar-brand fw-semibold">Online Bookstore</span>

          {/* Bootstrap Utility: d-flex + ms-auto to push actions to the right */}
          <div className="d-flex ms-auto align-items-center gap-2">
            <a className="btn btn-outline-info" href="/adminbooks">
              Admin Books
            </a>
            <button
              className="btn btn-outline-light position-relative"
              onClick={() => setViewMode('cart')}
              aria-label="Open shopping cart"
            >
              View Cart

              {/* Bootstrap Badge: rounded-pill + positioning utilities for a count bubble */}
              <span
                className="badge text-bg-warning rounded-pill position-absolute top-0 start-100 translate-middle"
                style={{ transform: 'translate(-35%, 35%)' }}
              >
                {cartItemCount}
              </span>
            </button>
          </div>
        </div>
      </nav>

      <div className="container my-4">
        <h1 className="mb-3">Online Bookstore</h1>
        <p className="text-muted mb-4">Browse books from the bookstore database.</p>

      {/* Bootstrap Grid: row + col-* controls responsive page structure */}
      <div className="row g-4">
        <div className="col-lg-9">
          {/* Bootstrap Utility classes: d-flex, gap, align-items-center for control alignment */}
          <div className="d-flex flex-wrap gap-3 align-items-center mb-3">
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

            <label className="me-2 fw-semibold" htmlFor="categorySelect">
              Category:
            </label>
            <select
              id="categorySelect"
              className="form-select d-inline-block w-auto"
              value={selectedCategory}
              onChange={handleCategoryChange}
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            {/* Bootstrap Badge: highlights current list position in a compact style */}
            <span className="badge text-bg-secondary">
              Page {page} / {totalPages}
            </span>
          </div>

          {loading && <div className="alert alert-info">Loading books...</div>}
          {error && <div className="alert alert-danger">{error}</div>}

          {!loading && !error && viewMode === 'shopping' && books.length === 0 && (
            <div className="alert alert-warning">No books found.</div>
          )}

          {!loading && !error && viewMode === 'shopping' && books.length > 0 && (
            <div className="table-responsive">
              {/* Main catalog table listing books returned for current page/filter/sort */}
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
                    <th scope="col">Cart</th>
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
                      <td>
                        {/* Cart action for this specific book */}
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => addToCart(book)}
                        >
                          Add to Cart
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !error && viewMode === 'shopping' && (
            <nav aria-label="Books pagination" className="mt-3">
              {/* Dynamic pagination links are built from totalPages. */}
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
          )}

          {!loading && !error && viewMode === 'cart' && (
            <div className="mt-3">
              <h2 className="h4">Shopping Cart</h2>
              {cartItems.length === 0 ? (
                <div className="alert alert-warning">Your cart is empty.</div>
              ) : (
                <div className="table-responsive">
                  {/* Cart table shows line-item math: quantity, subtotal, and total */}
                  <table className="table table-bordered align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Title</th>
                        <th className="text-end">Price</th>
                        <th className="text-center">Quantity</th>
                        <th className="text-end">Subtotal</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cartItems.map((item) => (
                        <tr key={item.book.isbn}>
                          <td>{item.book.title}</td>
                          <td className="text-end">${item.book.price.toFixed(2)}</td>
                          <td className="text-center" style={{ maxWidth: '120px' }}>
                            <input
                              type="number"
                              min={1}
                              className="form-control text-center"
                              value={item.quantity}
                              onChange={(e) =>
                                updateCartQuantity(item.book.isbn, Number(e.target.value))
                              }
                            />
                          </td>
                          <td className="text-end">
                            ${(item.book.price * item.quantity).toFixed(2)}
                          </td>
                          <td>
                            <button
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => removeFromCart(item.book.isbn)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} className="text-end fw-semibold">
                          Total
                        </td>
                        <td className="text-end fw-semibold">${cartTotal.toFixed(2)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              <button className="btn btn-secondary" onClick={continueShopping}>
                Continue Shopping
              </button>
            </div>
          )}
        </div>

        <div className="col-lg-3">
          {/* Bootstrap Card + Shadow: visual side panel for cart summary */}
          <div className="card shadow-sm border-0">
            {/* Bootstrap contextual background utility class for visual emphasis */}
            <div className="card-header bg-primary text-white fw-semibold">Cart Summary</div>
            <div className="card-body">
              <p className="mb-1">Items: {cartItemCount}</p>
              <p className="mb-2">Total: ${cartTotal.toFixed(2)}</p>
              <p className="text-muted small mb-1">Books in cart vs all books</p>

              {/* Bootstrap Progress component: unique visual for cart coverage */}
              <div className="progress mb-3" role="progressbar" aria-valuenow={cartFillPercent} aria-valuemin={0} aria-valuemax={100}>
                <div className="progress-bar progress-bar-striped progress-bar-animated" style={{ width: `${cartFillPercent}%` }}>
                  {cartFillPercent}%
                </div>
              </div>

              <button
                className="btn btn-primary w-100"
                onClick={() => setViewMode('cart')}
              >
                View Cart
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  )
}

export default App
