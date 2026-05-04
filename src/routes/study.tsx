import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/study")({
  component: StudyLayout,
});

function StudyLayout() {
  return <Outlet />;
}

