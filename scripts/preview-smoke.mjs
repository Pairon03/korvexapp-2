import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const base = process.env.PREVIEW_URL || "http://localhost:3100";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base);
  await page
    .getByRole("link", { name: /Explorar a prévia/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Alunos", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Buscar aluno de exemplo" })
    .fill("Ana");
  assert.equal(await page.getByRole("heading", { name: /Ana/ }).count(), 1);
  assert.equal(await page.getByRole("heading", { name: /Rafael/ }).count(), 0);
  for (const name of ["Programas", "Avaliações", "Agentes de IA", "Ciclos"]) {
    await page.getByRole("button", { name, exact: true }).click();
    assert.equal(
      await page.getByRole("heading", { level: 1, name, exact: true }).count(),
      1,
    );
  }
  await page
    .getByRole("button", { name: "Ver área do aluno", exact: true })
    .click();
  assert.equal(
    await page.getByRole("button", { name: "Alunos", exact: true }).count(),
    0,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  const health = await page.request.get(`${base}/api/health`);
  assert.equal((await health.json()).status, "preview");
  for (const path of ["/api/auth/register", "/api/photos/upload"]) {
    assert.equal(
      (await page.request.post(`${base}${path}`, { data: {} })).status(),
      503,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "Preview passed: navigation, search, student view, mobile width, disabled backend, no browser errors.",
  );
} finally {
  await browser.close();
}
