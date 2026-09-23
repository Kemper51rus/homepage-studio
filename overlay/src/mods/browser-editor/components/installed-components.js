import DashboardStudio from "./dashboard-studio";

function HomepageStudioOverlay({ host }) {
  const props = host?.editor?.homepageStudio;
  if (!props?.open) return null;
  return <DashboardStudio {...props.dashboardProps} />;
}

export const installedEditorComponents = Object.freeze([
  Object.freeze({
    id: "homepage-studio",
    Overlay: HomepageStudioOverlay,
  }),
]);
