import { BlogSection } from './blog/BlogSection'
import { noticiasNoBuild, temBlog, type NoticiaPublica } from './blog/noticias'
import { ChessProcessSection } from './components/ChessProcessSection'
import { ApproachSection, ContactSection, ManifestoSection, Marquee, PartnersSection, SolutionsSection, TeamSection, ThumdraSection } from './components/ContentSections'
import { HeroSection } from './components/HeroSection'
import { SiteFooter, SiteNavigation } from './components/SiteChrome'

export default function App({ noticias = noticiasNoBuild() }: { noticias?: NoticiaPublica[] }) {
  const mostrarBlog = temBlog(noticias)
  return (
    <>
      <SiteNavigation mostrarBlog={mostrarBlog} />
      <main>
        <HeroSection mostrarBlog={mostrarBlog} />
        <ThumdraSection />
        <SolutionsSection />
        <ChessProcessSection />
        <Marquee />
        <ApproachSection />
        <TeamSection />
        <PartnersSection />
        <ManifestoSection />
        {mostrarBlog && <BlogSection noticias={noticias} />}
        <ContactSection />
      </main>
      <SiteFooter mostrarBlog={mostrarBlog} />
    </>
  )
}
