import { BlogSection } from './blog/BlogSection'
import { ChessProcessSection } from './components/ChessProcessSection'
import { ApproachSection, ContactSection, ManifestoSection, Marquee, PartnersSection, SolutionsSection, TeamSection, ThumdraSection } from './components/ContentSections'
import { HeroSection } from './components/HeroSection'
import { SiteFooter, SiteNavigation } from './components/SiteChrome'

export default function App() {
  return (
    <>
      <SiteNavigation />
      <main>
        <HeroSection />
        <ThumdraSection />
        <SolutionsSection />
        <ChessProcessSection />
        <Marquee />
        <ApproachSection />
        <TeamSection />
        <PartnersSection />
        <ManifestoSection />
        <BlogSection />
        <ContactSection />
      </main>
      <SiteFooter />
    </>
  )
}
