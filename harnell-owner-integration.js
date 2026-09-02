/* Fusion Flavours Community Meals Owner integration
   Community Meals data is loaded only when its Owner screen is opened.
*/
(() => {
  'use strict';

  async function loadData() {
    const [menu, orders, items, links] = await Promise.all([
      api('/rest/v1/harnell_menu_items?select=*,items(id,name,description,image_url,active,stock)&order=sort_order.asc,id.asc'),
      api('/rest/v1/harnell_orders?select=*&order=created_at.desc&limit=200'),
      api('/rest/v1/harnell_order_items?select=*&order=harnell_order_id.desc,id.asc'),
      api('/rest/v1/welcome_links?select=*&order=sort_order.asc,id.asc')
    ]);
    const data = window.ownerData || (window.ownerData = {});
    data.harnellMenu = menu || [];
    data.harnellOrders = (orders || []).filter(order =>
      order.payment_method === 'pay_later' || String(order.payment_status || '').toLowerCase() === 'paid'
    );
    data.harnellOrderItems = items || [];
    data.welcomeLinks = links || [];
  }

  function orderLines(id) {
    return (window.ownerData?.harnellOrderItems || [])
      .filter(item => Number(item.harnell_order_id) === Number(id));
  }

  // These helpers originally lived inside a legacy block removed by the Owner-shell
  // migration. Keep the globals available for the remaining Community Orders views.
  window.loadHarnellOwnerData = loadData;
  window.harnellOrderLines = orderLines;

  async function beforeRender() {
    try {
      await loadData();
    } catch (error) {
      throw new Error(`Could not load Community Meals data: ${error?.message || error}`);
    }
  }

  async function render() {
    if (typeof window.renderHarnellAdmin === 'function') return window.renderHarnellAdmin();
    try { if (typeof renderHarnellAdmin === 'function') return renderHarnellAdmin(); } catch (_) {}
    throw new Error('Community Meals Owner renderer is unavailable');
  }

  const integration = { beforeRender, render };
  window.FusionHarnellOwner = integration;
  window.FusionOwnerRouter?.register?.('harnell', { beforeRender, render });
})();
