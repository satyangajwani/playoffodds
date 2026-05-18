import type { FC, PropsWithChildren } from "hono/jsx";

interface LayoutProps {
  title: string;
  description: string;
  embedded?: boolean;
  historical?: boolean;
  ogPath?: string;
}

export const Layout: FC<PropsWithChildren<LayoutProps>> = ({
  title,
  description,
  embedded,
  historical,
  ogPath,
  children,
}) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="referrer" content="strict-origin-when-cross-origin" />
      {/* OpenGraph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      {ogPath ? <meta property="og:image" content={ogPath} /> : null}
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta name="twitter:card" content="summary_large_image" />
      {/* Fonts via Google Fonts CDN — self-hosting will happen in Phase D */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,700;9..144,800&display=swap"
        rel="stylesheet"
      />
      <link rel="stylesheet" href="/styles.css" />
    </head>
    <body class={`${historical ? "historical" : ""} ${embedded ? "embed" : ""}`.trim()}>
      <main>{children}</main>
    </body>
  </html>
);
