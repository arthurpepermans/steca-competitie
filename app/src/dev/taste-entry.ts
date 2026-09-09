// Aparte ontwikkelpagina: wordt niet meegenomen in de productiebuild.
if (import.meta.env.DEV) {
  const { installeerTestgegevens } = await import("./taste-data");
  installeerTestgegevens();
  await import("./TastePreview");
}
export {};
