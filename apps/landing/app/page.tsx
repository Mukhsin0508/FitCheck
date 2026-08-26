import { Footer } from "@/components/footer";
import { Gallery } from "@/components/gallery";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { Nav } from "@/components/nav";
import { OpenSource } from "@/components/open-source";
import { WhyItWins } from "@/components/why-it-wins";

export default function Home() {
  return (
    <div id="top">
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <Gallery />
        <WhyItWins />
        <OpenSource />
      </main>
      <Footer />
    </div>
  );
}
