import { expect } from '@playwright/test';

// Fecha y hora fijas para que los datos de demostración sean siempre los mismos
// (viernes 6 de noviembre de 2026, 11:30, hora de Madrid).
export const FIXED_NOW = new Date('2026-11-06T11:30:00+01:00');

export const isMovil = testInfo => testInfo.project.name.includes('movil');
export const tag = testInfo => (isMovil(testInfo) ? 'movil' : 'escritorio');

// Abre KOVO (original o Vite según el proyecto) con datos de demostración recién creados.
export async function openApp(page, testInfo) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto(testInfo.project.metadata.url);
  await waitReady(page);
  return errors;
}

export async function waitReady(page) {
  await page.waitForFunction(() => {
    const v = document.getElementById('view');
    return v && v.children.length > 0 && !v.querySelector('.sk');
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
}

// Clic por DOM: funciona igual en escritorio y móvil aunque el elemento esté oculto (barra lateral o inferior).
export async function act(page, selector) {
  await page.evaluate(sel => {
    const el = document.querySelector(sel);
    if (!el) throw new Error('No existe ' + sel);
    el.click();
  }, selector);
  await page.waitForTimeout(120);
}

export const go = (page, view) => act(page, `[data-act="go"][data-v="${view}"]`);

export async function setRole(page, role) {
  // Desde la interfaz v3 el selector lista usuarios de ejemplo (u1…u4), uno por perfil.
  await page.evaluate(r => {
    const s = document.getElementById('role');
    s.value = { psicologa: 'u1', recepcion: 'u2', gestoria: 'u3', agenda: 'u4' }[r] || r;
    s.dispatchEvent(new Event('change', { bubbles: true }));
  }, role);
  await page.waitForTimeout(150);
}

export async function openSection(page, id) {
  await page.evaluate(i => { document.getElementById(i).open = true; }, id);
  await page.waitForTimeout(250);
}

export async function typeIn(page, selector, text) {
  await page.evaluate(([sel, t]) => {
    const el = document.querySelector(sel);
    el.value = t;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, [selector, text]);
  await page.waitForTimeout(120);
}

export async function snap(page, testInfo, name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot(`${tag(testInfo)}-${name}.png`, { fullPage: true });
}
