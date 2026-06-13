'use client';

import { VSLSlideshow } from '@/components/sales-page/VSLSlideshow';
import { VSL_STARTER_SLIDES } from '@/lib/mindshift/vslStarterSlides';

export default function MillionaireMindshiftVSLSlidesStarterRoute() {
  return (
    <VSLSlideshow
      deckTitle="Beginner VSL Storyboard"
      backHref="/millionaire-mindshift/vsl-script-starter"
      slides={VSL_STARTER_SLIDES}
    />
  );
}
