import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { exerciseCatalog } from "../src/domain/exercise-catalog.ts";
const base = process.env.PREVIEW_URL || "http://127.0.0.1:3100";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
await mkdir("test-results", { recursive: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/biblioteca`);
  await page.locator('[data-3d-ready="true"]').waitFor({ timeout: 30000 });
  assert.equal(
    await page
      .getByRole("button", { name: "Pausar animação", exact: true })
      .count(),
    0,
    "animations never autoplay",
  );
  await page
    .getByRole("searchbox", { name: "Buscar exercício", exact: true })
    .fill("biceps");
  assert.equal(
    await page.getByRole("button", { name: /^Ver animação de / }).count(),
    3,
    "accent-insensitive search",
  );
  await page
    .getByRole("searchbox", { name: "Buscar exercício", exact: true })
    .fill("");
  await page.getByRole("button", { name: /^Abdômen/ }).click();
  await page
    .getByRole("combobox", { name: "Filtrar equipamento" })
    .selectOption("Peso corporal");
  assert.equal(
    await page.getByRole("button", { name: /^Ver animação de / }).count(),
    2,
    "combined group/equipment filters",
  );
  await page.getByRole("button", { name: /^Todos/ }).click();
  await page
    .getByRole("combobox", { name: "Filtrar equipamento" })
    .selectOption("Todos");
  while (
    await page.getByRole("button", { name: /Mostrar mais exercícios/ }).count()
  )
    await page.getByRole("button", { name: /Mostrar mais exercícios/ }).click();
  assert.equal(
    await page.getByRole("button", { name: /^Ver animação de / }).count(),
    38,
  );
  for (const [index, ex] of exerciseCatalog.entries()) {
    await page
      .getByRole("button", { name: `Ver animação de ${ex.name}`, exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.locator('[data-3d-ready="true"]').waitFor({ timeout: 30000 });
    assert.equal(
      await dialog
        .getByRole("heading", { level: 2, name: ex.name, exact: true })
        .count(),
      1,
    );
    await dialog
      .getByRole("combobox", { name: "Ângulo da animação" })
      .selectOption("side");
    if (index === 0) {
      const canvas = dialog.locator("canvas");
      const before = await canvas.screenshot();
      await dialog
        .getByRole("button", { name: "Reproduzir animação", exact: true })
        .last()
        .click();
      await page.waitForFunction(
        () =>
          Number(document.querySelector('dialog input[type="range"]').value) >
          22,
      );
      await dialog
        .getByRole("button", { name: "Pausar animação", exact: true })
        .click();
      const after = await canvas.screenshot();
      assert.notDeepEqual(
        before,
        after,
        "actual 3D canvas changes with playback",
      );
      const position = await dialog
        .getByRole("slider", { name: "Progresso da animação" })
        .inputValue();
      await page.waitForTimeout(150);
      assert.equal(
        await dialog
          .getByRole("slider", { name: "Progresso da animação" })
          .inputValue(),
        position,
        "pause stops progress",
      );
      await dialog
        .getByRole("combobox", { name: "Velocidade da animação" })
        .selectOption("0.5");
      await dialog
        .getByRole("button", { name: "Reiniciar animação", exact: true })
        .click();
      assert.equal(
        await dialog
          .getByRole("slider", { name: "Progresso da animação" })
          .inputValue(),
        "0",
      );
      await page.screenshot({ path: "test-results/animation-3d-desktop.png" });
    }
    await dialog.getByRole("button", { name: "Fechar demonstração" }).click();
    assert.equal(await page.getByRole("dialog").count(), 0);
  }
  console.log(
    "38/38 animations: WebGL, dialog lifecycle, camera and canonical names passed.",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page
    .getByRole("button", {
      name: "Ver animação de Agachamento goblet",
      exact: true,
    })
    .click();
  await page.getByRole("dialog").locator('[data-3d-ready="true"]').waitFor();
  assert.equal(
    await page
      .getByRole("dialog")
      .evaluate((e) => e.scrollWidth <= e.clientWidth),
    true,
    "mobile dialog has no horizontal overflow",
  );
  await page.screenshot({ path: "test-results/animation-3d-mobile.png" });
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.goto(`${base}/previa`);
  await page.getByRole("button", { name: "Biblioteca", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Adicionar Supino reto com barra à biblioteca",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: /Ver treino de exemplo/ }).click();
  assert.equal(
    await page.getByText("Supino reto com barra", { exact: true }).count(),
    1,
  );
  assert.equal(
    await page.locator("canvas").count(),
    0,
    "closed workout demonstrations don't allocate WebGL contexts",
  );
  await page
    .getByRole("button", { name: "Ver área do aluno", exact: true })
    .click();
  await page.getByRole("button", { name: "Programas", exact: true }).click();
  await page.locator("summary").first().click();
  await page.locator('[data-3d-ready="true"]').waitFor();
  assert.equal(
    await page.locator("canvas").count(),
    1,
    "student sees the selected exercise animation",
  );
  await page.screenshot({ path: "test-results/student-animation-mobile.png" });
  assert.deepEqual(errors, []);
  console.log(
    "Filters, playback, pause, restart, speed, actual canvas changes, keyboard close, mobile, demo selection and student integration passed. No browser errors.",
  );
} finally {
  await browser.close();
}
