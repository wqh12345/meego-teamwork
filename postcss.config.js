module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
    // px 自动转换 rem，解决移动端小屏适配问题
    'postcss-pxtorem': {
      rootValue: 37.5, // 设计稿宽度 375px / 10 = 37.5
      unitPrecision: 5, // 转换后保留小数位数
      propList: ['*'], // 转换所有属性
      selectorBlackList: ['.ignore-', '.hairlines', 'body'], // 不转换的类名
      minPixelValue: 2, // 小于 2px 不转换（保留 1px 边框）
      mediaQuery: false, // 媒体查询中不转换
      // 排除 web 端代码，只处理移动端
      exclude: function(file) {
        return file.includes('node_modules') || file.includes('features/web');
      },
    },
  },
}
