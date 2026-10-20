/* Pre-paint theme bootstrap: sets data-theme and color-scheme before first paint (no flash). */
      (function () {
        try {
          var root = document.documentElement
          var pref = localStorage.getItem('kw-theme') || 'system'
          var dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
          root.dataset.theme = dark ? 'dark' : 'light'
          root.style.colorScheme = dark ? 'dark' : 'light'
          if (pref !== 'system') {
            document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
              m.setAttribute('content', dark ? '#191919' : '#ffffff')
              m.removeAttribute('media')
            })
          }
          var glass = localStorage.getItem('kw-glass') || 'auto'
          root.dataset.glass = glass === 'auto' ? 'full' : glass
        } catch (e) {}
      })()
