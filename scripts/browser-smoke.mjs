import { chromium } from "@playwright/test";
import { randomUUID, randomBytes } from "node:crypto";
import { readdir, readFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import sharp from "sharp";
(async () => {
  const url = process.env.APP_URL || "http://localhost:3000";
  const email = `e2e-${randomUUID()}@example.test`,
    password = randomBytes(20).toString("hex");
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await mkdir("test-results", { recursive: true });
  async function api(path, body) {
    const r = await page.request.post(`${url}/api/${path}`, {
      headers: { Origin: url },
      data: body,
    });
    const value = await r.json();
    assert.equal(r.ok(), true, `${path}: ${value.message}`);
    return value;
  }
  async function nav(name) {
    await page
      .getByRole("navigation", { name: "Navegação da plataforma" })
      .getByRole("button", { name, exact: true })
      .click();
  }
  async function submitDialog(button) {
    await page
      .getByRole("dialog")
      .getByRole("button", { name: button, exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
  }
  try {
    await page.goto(url);
    await page.getByRole("heading", { name: /Você orienta/ }).waitFor();
    await page.screenshot({
      path: "test-results/landing-desktop.png",
      fullPage: true,
    });
    await page.getByRole("link", { name: /Criar meu espaço/ }).click();
    await page
      .getByLabel("Seu nome", { exact: true })
      .fill("Personal de teste");
    await page
      .getByLabel("Nome profissional ou organização")
      .fill("Organização de teste E2E");
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Criar conta", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: /Conta criada/ })
      .waitFor();
    let mail;
    for (const file of await readdir(".local/mail")) {
      const candidate = JSON.parse(
        await readFile(`.local/mail/${file}`, "utf8"),
      );
      if (
        candidate.to === email &&
        candidate.subject === "Confirme sua conta FitCore"
      )
        mail = candidate;
    }
    assert.ok(mail, "Development email was queued");
    const verify = mail.text.match(/https?:\/\/\S+/)[0];
    await page.goto(verify);
    await page.getByRole("button", { name: "Confirmar e-mail" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: /E-mail confirmado/ })
      .waitFor();
    await page.goto(`${url}/entrar`);
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.getByRole("heading", { name: /Vamos evoluir/ }).waitFor();
    console.log("PASS registration, email outbox, verification and login");
    await nav("Alunos");
    await page
      .getByRole("button", { name: "Cadastrar aluno", exact: true })
      .click();
    await page
      .getByLabel("Nome do aluno", { exact: true })
      .fill("Aluno sintético E2E");
    await page
      .getByLabel("E-mail do aluno", { exact: true })
      .fill(`student-${randomUUID()}@example.test`);
    await page
      .getByLabel("Equipamentos disponíveis (separados por vírgula)")
      .fill("halteres");
    await submitDialog("Cadastrar aluno");
    await page.getByRole("heading", { name: "Aluno sintético E2E" }).waitFor();
    await nav("Biblioteca");
    await page
      .getByRole("button", { name: "Adicionar exercício", exact: true })
      .click();
    await page
      .getByLabel("Nome", { exact: true })
      .fill("Supino com halteres — teste");
    await page.getByLabel("Grupo muscular principal").fill("Peito");
    await page
      .getByLabel("Equipamento (igual ao cadastrado no aluno)")
      .fill("halteres");
    await page
      .getByLabel("Instruções originais de execução")
      .fill("Instruções sintéticas de teste, sem prescrição para uso real.");
    await submitDialog("Adicionar exercício");
    await nav("Agentes de IA");
    await page
      .getByRole("button", { name: "Criar agente", exact: true })
      .click();
    await page.getByLabel("Nome do agente").fill("Agente de teste");
    await submitDialog("Criar agente");
    await nav("Avaliações");
    await page
      .getByRole("button", { name: "Nova avaliação", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("Aluno", { exact: true })
      .selectOption({ label: "Aluno sintético E2E" });
    await page.getByLabel("Peso (kg)", { exact: true }).fill("70");
    await page.getByLabel("Altura (cm)", { exact: true }).fill("170");
    await submitDialog("Salvar avaliação");
    await page.getByRole("cell", { name: "70 kg", exact: true }).waitFor();
    console.log("PASS student, exercise, versioned agent and assessment forms");
    await nav("Programas");
    await page
      .getByRole("button", { name: "Criar programa manual", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("Aluno", { exact: true })
      .selectOption({ label: "Aluno sintético E2E" });
    await page
      .getByLabel("Agente e versão para o próximo ciclo")
      .selectOption({ label: "Agente de teste · v1" });
    await page.getByLabel("Nome do programa").fill("Programa sintético E2E");
    await page
      .getByLabel("Motivo da criação ou alteração")
      .fill("Teste de publicação no servidor");
    await page
      .getByRole("button", { name: "Adicionar exercício", exact: true })
      .click();
    await submitDialog("Validar e salvar proposta");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Publicar nova versão" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: /Registro salvo/ })
      .waitFor();
    await page
      .getByRole("button", { name: "Registrar treino", exact: true })
      .waitFor();
    const data = await (await page.request.get(`${url}/api/dashboard`)).json();
    assert.equal(data.versions.length, 1);
    assert.equal(data.cycles.length, 1);
    assert.equal(data.cycles[0].status, "scheduled");
    await page
      .getByRole("button", { name: "Registrar treino", exact: true })
      .click();
    await page.getByLabel("Carga (kg)").fill("20");
    await page.getByLabel("Repetições", { exact: true }).fill("10");
    await page
      .getByRole("button", { name: "Concluir série", exact: true })
      .click();
    await page
      .getByText("1 série(s) registradas no rascunho", { exact: true })
      .waitFor();
    page.once("dialog", (d) => d.accept());
    await submitDialog("Finalizar e salvar no servidor");
    await page.getByText(/200 kg de volume estimado/).waitFor();
    await page.reload();
    await page.getByRole("heading", { name: /Vamos evoluir/ }).waitFor();
    await nav("Programas");
    await page.getByText(/200 kg de volume estimado/).waitFor();
    console.log(
      "PASS manual validation, immutable publication, cycle creation, workout and reload persistence",
    );
    const me = await (await page.request.get(`${url}/api/auth/me`)).json();
    const a = await page.request.get(`${url}/api/dashboard`, {
      headers: { "x-tenant-id": randomUUID() },
    });
    assert.equal(a.status(), 403);
    const ai = await page.request.post(`${url}/api/proposals/generate`, {
      headers: { Origin: url },
      data: {
        studentId: data.students[0].id,
        agentVersionId: data.agents[0].version_id,
      },
    });
    assert.equal(ai.status(), 503);
    const checkout = await page.request.post(`${url}/api/billing/checkout`, {
      headers: { Origin: url },
      data: { planId: "essential" },
    });
    assert.equal(checkout.status(), 503);
    const csrf = await page.request.post(`${url}/api/students`, {
      headers: { Origin: "https://untrusted.example" },
      data: {},
    });
    assert.equal(csrf.status(), 403);
    const exported = await page.request.get(`${url}/api/export`);
    assert.equal(exported.ok(), true);
    assert.equal((await exported.json()).students.length, 1);
    await api("students/invite", { studentId: data.students[0].id });
    let invitation;
    for (const file of await readdir(".local/mail")) {
      const m = JSON.parse(await readFile(`.local/mail/${file}`, "utf8"));
      if (m.to === data.students[0].email && m.subject === "Convite FitCore")
        invitation = m;
    }
    assert.ok(invitation);
    const student = await browser.newPage({
      viewport: { width: 390, height: 844 },
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
    });
    await student.goto(invitation.text.match(/https?:\/\/\S+/)[0]);
    await student
      .getByLabel("Senha", { exact: true })
      .fill(randomBytes(20).toString("hex"));
    await student.getByRole("button", { name: "Aceitar convite" }).click();
    await student.getByRole("heading", { name: /Vamos evoluir/ }).waitFor();
    assert.equal(
      await student
        .getByRole("navigation", { name: "Navegação da plataforma" })
        .getByRole("button", { name: "Alunos", exact: true })
        .count(),
      0,
    );
    await student
      .getByRole("navigation", { name: "Navegação da plataforma" })
      .getByRole("button", { name: "Programas", exact: true })
      .click();
    await student
      .getByRole("heading", { name: "Programa sintético E2E", exact: true })
      .waitFor();
    await student
      .getByRole("navigation", { name: "Navegação da plataforma" })
      .getByRole("button", { name: "Avaliações", exact: true })
      .click();
    await student
      .getByRole("button", { name: "Autorizar armazenamento privado de fotos" })
      .click();
    await student
      .getByRole("button", { name: "Revogar autorização e excluir fotos" })
      .waitFor();
    const image = await sharp({
      create: { width: 40, height: 40, channels: 3, background: "#b8ff3b" },
    })
      .png()
      .toBuffer();
    await student.locator("input[type=file]").setInputFiles({
      name: "synthetic-fixture.png",
      mimeType: "image/png",
      buffer: image,
    });
    await student
      .getByRole("button", { name: "Enviar foto privada", exact: true })
      .click();
    await student
      .getByRole("status")
      .filter({ hasText: /Foto salva/ })
      .waitFor();
    const pictures = await (
      await student.request.get(`${url}/api/photos`)
    ).json();
    assert.equal(pictures.photos.length, 1);
    const signed = await student.request.post(`${url}/api/photos/link`, {
      headers: { Origin: url },
      data: { photoId: pictures.photos[0].id },
    });
    const access = (await signed.json()).url;
    assert.equal((await student.request.get(`${url}${access}`)).status(), 200);
    assert.equal((await page.request.get(`${url}${access}`)).status(), 403);
    student.once("dialog", (d) => d.accept());
    await student
      .getByRole("button", { name: "Revogar autorização e excluir fotos" })
      .click();
    await student
      .getByRole("button", { name: "Autorizar armazenamento privado de fotos" })
      .waitFor();
    assert.equal(
      (await (await student.request.get(`${url}/api/photos`)).json()).photos
        .length,
      0,
    );
    await student.screenshot({
      path: "test-results/student-mobile.png",
      fullPage: true,
    });
    await student.close();
    console.log(
      "PASS real invitation, student login, own program, photo consent, private upload/access, cross-user link denial and revocation",
    );
    const trainerEmail = `trainer-${randomUUID()}@example.test`;
    await api("organization/invite", { name: "Profissional sintético", email: trainerEmail });
    let trainerMail;
    for (const file of await readdir(".local/mail")) {
      const m = JSON.parse(await readFile(`.local/mail/${file}`, "utf8"));
      if (m.to === trainerEmail && m.subject === "Convite profissional FitCore") trainerMail = m;
    }
    assert.ok(trainerMail);
    const trainer = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: "pt-BR" });
    await trainer.goto(trainerMail.text.match(/https?:\/\/\S+/)[0]);
    await trainer.getByLabel("Senha", { exact: true }).fill(randomBytes(20).toString("hex"));
    await trainer.getByRole("button", { name: "Aceitar convite" }).click();
    await trainer.getByRole("heading", { name: /Vamos evoluir/ }).waitFor();
    const trainerActor = await (await trainer.request.get(`${url}/api/auth/me`)).json();
    assert.equal(trainerActor.role, "trainer");
    const forbiddenSettings = await trainer.request.post(`${url}/api/organization/settings`, { headers: { Origin: url }, data: { name: "Forbidden", timezone: "UTC" } });
    assert.equal(forbiddenSettings.status(), 403);
    await trainer.close();
    console.log("PASS professional invitation and owner-only organization permission");
    await nav("Visão geral");
    await page.screenshot({
      path: "test-results/dashboard-desktop.png",
      fullPage: true,
    });
    const mobile = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await mobile.goto(url);
    await mobile.getByRole("heading", { name: /Você orienta/ }).waitFor();
    assert.equal(
      await mobile.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
    );
    await mobile.screenshot({
      path: "test-results/landing-mobile.png",
      fullPage: true,
    });
    await mobile.close();
    await api("auth/logout", {});
    assert.equal(
      (await page.request.get(`${url}/api/dashboard`)).status(),
      401,
    );
    assert.ok(me.tenantId);
    assert.deepEqual(errors, []);
    console.log(
      "PASS cross-tenant denial, CSRF rejection, unconfigured AI/billing fail closed, export and logout",
    );
  } catch (e) {
    await page.screenshot({ path: "test-results/failure.png", fullPage: true });
    throw e;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
