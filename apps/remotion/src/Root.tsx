import { Composition } from "remotion";
import { HERO_COMPOSITION, HeroCampaignDemo } from "./compositions/HeroCampaignDemo";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="HeroCampaignDemo"
        component={HeroCampaignDemo}
        durationInFrames={HERO_COMPOSITION.durationInFrames}
        fps={HERO_COMPOSITION.fps}
        width={HERO_COMPOSITION.width}
        height={HERO_COMPOSITION.height}
      />
    </>
  );
};
