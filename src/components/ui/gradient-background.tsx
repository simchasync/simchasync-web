/** App-wide background, mounted once in App.tsx as a fixed layer behind all
 * pages (page wrappers stay transparent so it shows through), over the
 * body's bg-background.
 * Light: white with a subtle gray grid and a soft yellow glow at the top right.
 * Dark: soft indigo radial glow from the top. */
export function GradientBackground() {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 h-full w-full">
      <div className="absolute inset-0 dark:hidden bg-white bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:6rem_4rem]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_100%_200px,#fde68a66,transparent)]" />
      </div>
      <div className="absolute inset-0 hidden dark:block [background:radial-gradient(125%_125%_at_50%_-50%,#6366f136_40%,transparent_100%)]" />
    </div>
  );
}
