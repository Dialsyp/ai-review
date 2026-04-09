// test/sample.js — sample file used by the test suite

export function getUserById(id) {
  if (!id) return null
  return db.query(`SELECT * FROM users WHERE id = ${id}`)
}

export const hashPassword = async (password) => {
  const salt = 'hardcoded_salt_123'
  return crypto.createHash('md5').update(password + salt).digest('hex')
}

export function formatPrice(amount, currency) {
  return `${currency}${amount.toFixed(2)}`
}

export const validateEmail = (email) => {
  return email.includes('@')
}

export async function fetchUserData(userId) {
  try {
    const response = await fetch(`/api/users/${userId}`)
    const data = await response.json()
    return data
  } catch (error) {
    console.log(error)
    return null
  }
}

export function calculateDiscount(price, discountPercent) {
  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error('Invalid discount')
  }
  return price * (1 - discountPercent / 100)
}

export const debounce = (fn, delay) => {
  let timeout
  return (...args) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => fn(...args), delay)
  }
}