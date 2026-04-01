import React, { useEffect, useState } from 'react'
import './App.css'

type Book = {
  bookId: number
  title: string
  author: string
  publisher: string
  isbn: string
  classification: string
  category: string
  pageCount: number
  price: number
}

type BooksResponse = {
  items: Book[]
  totalCount: number
}

type BookForm = Omit<Book, 'bookId'>
type TextField = 'title' | 'author' | 'publisher' | 'isbn' | 'classification' | 'category'

const emptyForm: BookForm = {
  title: '',
  author: '',
  publisher: '',
  isbn: '',
  classification: '',
  category: '',
  pageCount: 1,
  price: 0,
}

const apiBase = '/api/books'
const textFields: TextField[] = ['title', 'author', 'publisher', 'isbn', 'classification', 'category']

const AdminBooks: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([])
  const [form, setForm] = useState<BookForm>(emptyForm)
  const [pageCountInput, setPageCountInput] = useState('1')
  const [priceInput, setPriceInput] = useState('0.00')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadBooks = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${apiBase}?page=1&pageSize=1000&sortDir=asc`)
      if (!response.ok) {
        throw new Error(`Failed to load books: ${response.statusText}`)
      }
      const data: BooksResponse = await response.json()
      setBooks(data.items)
    } catch (err: any) {
      setError(err.message ?? 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBooks()
  }, [])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    if (name === 'pageCount') {
      const normalizedValue = value.replace(/[^0-9]/g, '')
      setPageCountInput(normalizedValue)
      setForm((prev) => ({ ...prev, pageCount: Number(normalizedValue || 0) }))
      return
    }

    if (name === 'price') {
      const normalizedValue = value.replace(/[^0-9.]/g, '')
      setPriceInput(normalizedValue)
      setForm((prev) => ({ ...prev, price: Number(normalizedValue || 0) }))
      return
    }

    setForm((prev) => ({
      ...prev,
      [name]: name === 'pageCount' ? Number(value) : value,
    }))
  }

  const resetForm = () => {
    setForm(emptyForm)
    setPageCountInput('1')
    setPriceInput('0.00')
    setEditingId(null)
  }

  const submitBook = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const parsedPageCount = Number(pageCountInput)
    if (Number.isNaN(parsedPageCount) || parsedPageCount <= 0) {
      setError('Please enter a valid page count greater than 0.')
      return
    }
    const parsedPrice = Number(priceInput)
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setError('Please enter a valid non-negative price.')
      return
    }
    const normalizedForm = { ...form, pageCount: parsedPageCount, price: parsedPrice }

    const method = editingId ? 'PUT' : 'POST'
    const url = editingId ? `${apiBase}/${editingId}` : apiBase

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...normalizedForm, bookId: editingId ?? 0 }),
    })

    if (!response.ok) {
      const message = await response.text()
      setError(message || `Request failed: ${response.statusText}`)
      return
    }

    resetForm()
    await loadBooks()
  }

  const startEdit = (book: Book) => {
    setEditingId(book.bookId)
    setForm({
      title: book.title,
      author: book.author,
      publisher: book.publisher,
      isbn: book.isbn,
      classification: book.classification,
      category: book.category,
      pageCount: book.pageCount,
      price: book.price,
    })
    setPageCountInput(book.pageCount.toString())
    setPriceInput(book.price.toFixed(2))
  }

  const deleteBook = async (id: number) => {
    const response = await fetch(`${apiBase}/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      setError(`Delete failed: ${response.statusText}`)
      return
    }
    if (editingId === id) {
      resetForm()
    }
    await loadBooks()
  }

  return (
    <div className="container my-4">
      <h1 className="mb-3">Admin Books</h1>
      <p className="text-muted">
        Add, update, and delete books. <a href="/">Back to storefront</a>
      </p>

      {error && <div className="alert alert-danger">{error}</div>}

      <form className="row g-3 mb-4" onSubmit={submitBook}>
        {textFields.map((field) => (
          <div className="col-md-4" key={field}>
            <input
              className="form-control"
              name={field}
              placeholder={field[0].toUpperCase() + field.slice(1)}
              value={form[field]}
              onChange={onInputChange}
              required
            />
          </div>
        ))}
        <div className="col-md-2">
          <label className="form-label mb-1" htmlFor="pageCountInput">
            Page Count
          </label>
          <input
            id="pageCountInput"
            className="form-control"
            type="text"
            inputMode="numeric"
            name="pageCount"
            placeholder="Page Count"
            value={pageCountInput}
            onChange={onInputChange}
            onBlur={() => setPageCountInput(form.pageCount > 0 ? form.pageCount.toString() : '1')}
            required
          />
        </div>
        <div className="col-md-2">
          <label className="form-label mb-1" htmlFor="priceInput">
            Price
          </label>
          <div className="input-group">
            <span className="input-group-text">$</span>
            <input
              id="priceInput"
              className="form-control"
              type="text"
              inputMode="decimal"
              name="price"
              placeholder="19.99"
              value={priceInput}
              onChange={onInputChange}
              onBlur={() => setPriceInput(form.price.toFixed(2))}
              required
            />
          </div>
        </div>
        <div className="col-12 d-flex gap-2">
          <button className="btn btn-primary" type="submit">
            {editingId ? 'Update Book' : 'Add Book'}
          </button>
          <button className="btn btn-outline-secondary" type="button" onClick={resetForm}>
            Clear
          </button>
        </div>
      </form>

      {loading ? (
        <div className="alert alert-info">Loading books...</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-striped table-hover">
            <thead className="table-light">
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>ISBN</th>
                <th>Category</th>
                <th className="text-end">Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {books.map((book) => (
                <tr key={book.bookId}>
                  <td>{book.title}</td>
                  <td>{book.author}</td>
                  <td>{book.isbn}</td>
                  <td>{book.category}</td>
                  <td className="text-end">${book.price.toFixed(2)}</td>
                  <td className="d-flex gap-2">
                    <button className="btn btn-sm btn-warning" onClick={() => startEdit(book)}>
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => deleteBook(book.bookId)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default AdminBooks
