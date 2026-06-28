// Зарезервированный слот карусели промо-баннеров на ленте. Контракт места — наполнение и логика
// (карусель promo_banners, действие internal|external|donate) подключаются в Фазе 10.
// Сейчас рендерит пустую область-маркер (присутствует в DOM, визуально пусто).

export function PromoCarouselSlot() {
  return <section aria-hidden="true" data-promo-slot="reserved" className="hidden" />;
}
