import { onMounted, onUnmounted, ref } from "vue";

/** 与 AdminLayout 待处理订单页移动端断点一致 */
export const ADMIN_MOBILE_MAX_PX = 768;

export function useIsMobile(breakpointPx = ADMIN_MOBILE_MAX_PX) {
  const isMobile = ref(false);
  let mql: MediaQueryList | null = null;

  const sync = (): void => {
    isMobile.value = window.matchMedia(`(max-width: ${breakpointPx}px)`).matches;
  };

  onMounted(() => {
    mql = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    sync();
    mql.addEventListener("change", sync);
  });

  onUnmounted(() => {
    mql?.removeEventListener("change", sync);
  });

  return { isMobile };
}
