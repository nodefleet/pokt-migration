/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,js}",
    "./src/components/**/*.js"
  ],
  theme: {
    extend: {
      fontFamily: {
        'urbanist': ['Urbanist', 'sans-serif'],
        'kumbh-sans': ['Kumbh Sans', 'sans-serif'],
      },
      colors: {
        'pokt-blue': '#00F5FF',
        'pokt-purple': '#7B61FF',
        'pokt-dark': '#1A1A1A',
      },
    },
  },
  plugins: [],
}