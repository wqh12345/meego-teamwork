/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  // 🔑 关键：不覆盖 antd-mobile 的基础样式
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      // 复用项目的设计 token
      colors: {
        primary: '#4247F6',
        'primary-hover': '#3D42D1',
        'primary-active': '#4247F6',
        'primary-bg': '#ECECFE',
        error: '#DF000E',
        'error-bg': '#FBE5E6',
        success: '#00AB7C',
        'success-bg': '#E5F6F1',
        warning: '#EB981A',
        'warning-bg': '#FDF4E8',
        'gray-50': '#F8F9FA',
        'gray-100': '#EDEDED',
        'gray-200': '#BBBBBB',
        'gray-600': '#727272',
        'gray-800': '#262626',
        'gray-900': '#222222',
      },
      borderRadius: {
        'lg': '8px',
        'xl': '12px',
        '2xl': '16px',
        '3xl': '20px',
        '4xl': '24px',
      },
      spacing: {
        '15': '60px',
      },
      fontSize: {
        'xs': '12px',
        'sm': '14px',
        'base': '16px',
        'lg': '18px',
        'xl': '26px',
      },
    },
  },
  plugins: [],
}
