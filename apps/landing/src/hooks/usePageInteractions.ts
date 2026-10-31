import { useEffect, useState } from 'react'

export function usePageInteractions(): boolean {
  const [isScrolled, setIsScrolled] = useState(() => window.scrollY > 40)

  useEffect(() => {
    const updateScrollState = () => setIsScrolled(window.scrollY > 40)
    const revealObserver = 'IntersectionObserver' in window
      ? new IntersectionObserver((entries, observer) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('in')
              observer.unobserve(entry.target)
            }
          })
        }, { threshold: 0.18, rootMargin: '0px 0px -40px 0px' })
      : null

    window.addEventListener('scroll', updateScrollState, { passive: true })
    document.querySelectorAll('.rv').forEach((element) => {
      if (revealObserver) revealObserver.observe(element)
      else element.classList.add('in')
    })

    return () => {
      window.removeEventListener('scroll', updateScrollState)
      revealObserver?.disconnect()
    }
  }, [])

  return isScrolled
}
