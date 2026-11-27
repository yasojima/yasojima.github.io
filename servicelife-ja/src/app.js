import { readSnapshot, disableConnections } from './core/data-reader.js';
import { parseRoute, routeHash, canOpen, supportsIndependent } from './core/router.js';
import { el, button, icon, notice } from './ui/elements.js';
import { bookingsView } from './ui/bookings-view.js';
import { remindersView } from './ui/reminders-view.js';
import { notificationsView, notificationPopover } from './ui/notifications-view.js';
import { locationsView } from './ui/locations-view.js';
import { customersView } from './ui/customers-view.js';
import { menuIcons } from './ui/menu-icons.js';
import { roleNavigation, sidebarClose } from './ui/sidebar-controls.js';
import { resourcesView } from './ui/resources-view.js';
import { settingsView, settingRoutes } from './ui/settings-view.js';
import { treatmentView } from './ui/treatment-view.js';
import { customerDetailView } from './ui/customer-detail-view.js';
import { invoicesView } from './ui/invoices-view.js';
import { paymentsView } from './ui/payments-view.js';
import { billingView } from './ui/billing-view.js';
import { disputesView } from './ui/disputes-view.js';
import { financeSettingsView,financeSettingsRoutes } from './ui/finance-settings-view.js';
import { accessDeniedView } from './ui/access-denied-view.js';
import { rootSettingsView } from './ui/root-settings-view.js';
import { lunchView } from './ui/lunch-view.js';
import { adminToolsView,adminToolRoutes } from './ui/admin-tools-view.js';
import { complianceView } from './ui/compliance-view.js';
import {fieldJobView} from './ui/field-job-view.js';
import {workspaceFrame} from './ui/workspace-frame.js';
import {inboxView} from './ui/inbox-view.js';
import {dashboardView} from './ui/dashboard-view.js';
import {routingView} from './ui/routing-view.js';
import {routesView} from './ui/routes-view.js';
import {biView} from './ui/bi-view.js';
import {csrDashboardView} from './ui/csr-dashboard-view.js';
import {contractsView} from './ui/contracts-view.js';
import {contractDocumentsView} from './ui/contract-documents-view.js';
import {maintenanceView} from './ui/maintenance-view.js';
import {businessView} from './ui/business-view.js';
import {chatView} from './ui/chat-view.js';
import {calendarView} from './ui/calendar-view.js';
import {myDayView} from './ui/my-day-view.js';
import {myLeadsView} from './ui/my-leads-view.js';
import {usersView} from './ui/users-view.js';
import {teamView} from './ui/team-view.js';
import {liveStaffView} from './ui/live-staff-view.js';
import {workforceView} from './ui/workforce-view.js';
import {leaderboardView} from './ui/leaderboard-view.js';
import {contestsView} from './ui/contests-view.js';
import {ticketsView} from './ui/tickets-view.js';
import {leadsView} from './ui/leads-view.js';
import {jobLogsView} from './ui/job-logs-view.js';
import {engagementView,engagementRoutes} from './ui/engagement-view.js';
import {utilitiesView,utilityRoutes} from './ui/utilities-view.js';
import {communicationsView} from './ui/communications-view.js';
import {drilldownView} from './ui/drilldowns-view.js';
import {supportPagesView,supportRoutes} from './ui/support-pages-view.js';
import {reportHubView} from './ui/report-hub-view.js';
import { staffReportsView,staffReportNames } from './ui/staff-reports-view.js';

disableConnections();
const app = document.getElementById('app');
const catalogPromise = readSnapshot('data/catalog.json');
let dispose = () => {}, generation = 0;
async function render() {
  const current = ++generation;
  try {
    const catalog = await catalogPromise;
    const place = parseRoute(location.hash);
    const owned = canOpen(catalog, place) && supportsIndependent(catalog, place);
    const data = owned ? await readSnapshot('data/' + place.role + '.json') : null;
    const notificationData = owned && place.path === '/notifications/' ? await readSnapshot('data/notifications-' + place.role + '.json') : null;
    const locationMatch = /^\/customers\/([^/]+)\/locations\/$/.exec(place.path);
    const locationData = owned && locationMatch ? await readSnapshot('data/locations-' + place.role + '.json') : null;
    const customerMatch=/^\/customers\/([^/]+)\/$/.exec(place.path);
    const customersData = owned && (place.path === '/customers/'||customerMatch) ? await readSnapshot('data/customers-' + place.role + '.json') : null;
    const histories=owned&&customerMatch?await readSnapshot('data/customer-history-'+place.role+'.json'):null;
    const billing=owned&&place.path.startsWith('/billing/')?await readSnapshot('data/billing-'+place.role+'.json'):null;
    const disputes=owned&&place.path.startsWith('/disputes/')?await readSnapshot('data/disputes.json'):null;
    const financeSettings=owned&&financeSettingsRoutes.includes(place.path)?await readSnapshot('data/finance-settings.json'):null;
    const rootSettings=owned&&place.path==='/settings/'&&place.role==='company_admin'?await readSnapshot('data/root-settings.json'):null;
    const adminTools=owned&&adminToolRoutes.includes(place.path)?await readSnapshot('data/admin-tools.json'):null;
    const compliance=owned&&(place.path==='/licenses/'||place.path.startsWith('/compliance/'))?await readSnapshot('data/compliance.json'):null;
    const fieldJob=owned&&place.path==='/field-job-card/'?await readSnapshot('data/field-jobs.json'):null;
    const inbox=owned&&place.path==='/csr-inbox/'?await readSnapshot('data/inbox-'+place.role+'.json'):null;
    const dashboard=owned&&place.path==='/dashboard/'?await readSnapshot('data/dashboard-'+place.role+'.json'):null;
    const routing=owned&&['/travel-routes/','/routing/density/'].includes(place.path)?await readSnapshot('data/routing.json'):null;
    const routes=owned&&place.path==='/routes/'?await readSnapshot('data/routes.json'):null;
    const bi=owned&&place.path==='/bi/'?await readSnapshot('data/bi.json'):null;
    const csrDashboard=owned&&place.path==='/csr-dashboard/'?await readSnapshot(`data/csr-dashboard-${place.role}.json`):null;
    const contracts=owned&&place.path==='/contracts/'?await readSnapshot(`data/contracts-${place.role}.json`):null;
    const contractDocuments=owned&&place.role==='csr'&&place.path==='/contracts/documents/'?await readSnapshot('data/contract-documents.json'):null;
    const maintenance=owned&&place.path==='/maintenance/'?await readSnapshot(`data/maintenance-${place.role}.json`):null;
    const business=owned&&place.path==='/business-manager/'&&place.role==='company_admin'?await readSnapshot('data/business.json'):null;
    const chat=owned&&place.path==='/chat/'?await readSnapshot('data/chat-'+place.role+'.json'):null;
    const calendar=owned&&place.path==='/calendar/'?await readSnapshot('data/calendar-'+place.role+'.json'):null;
    const myDay=owned&&place.path==='/my-day/'?await readSnapshot('data/my-day.json'):null;
    const myLeads=owned&&place.path==='/my-leads/'?await readSnapshot('data/my-leads.json'):null;
    const users=owned&&place.path==='/users/'?await readSnapshot('data/users.json'):null;
    const staff=owned&&['/tech-team/','/technicians/'].includes(place.path)?await readSnapshot('data/staff.json'):null;
    const workforce=owned&&['/territories/','/time-tracking/'].includes(place.path)?await readSnapshot('data/workforce.json'):null;
    const leaderboard=owned&&place.path==='/tech-team/leaderboard/'?await readSnapshot('data/leaderboard.json'):null;
    const contest=owned&&['/contest/','/my-contest/'].includes(place.path)?await readSnapshot('data/contest-'+place.role+'.json'):null;
    const tickets=owned&&place.path==='/tickets/'?await readSnapshot('data/tickets-'+place.role+'.json'):null;
    const leads=owned&&place.path==='/leads/'?await readSnapshot('data/leads-'+place.role+'.json'):null;
    const jobLogs=owned&&['/job-logs/','/my-job-logs/'].includes(place.path)?await readSnapshot('data/job-logs-'+place.role+'.json'):null;
    const engagement=owned&&engagementRoutes.includes(place.path)?await readSnapshot('data/engagement-'+place.role+'.json'):null;
    const utilities=owned&&utilityRoutes.includes(place.path)?await readSnapshot('data/utilities-'+place.role+'.json'):null;
    const communications=owned&&['/call-log/','/canned-responses/'].includes(place.path)?await readSnapshot('data/communications-'+place.role+'.json'):null;
    const drilldowns=owned&&place.path.startsWith('/dashboard/drilldown/')?await readSnapshot('data/drilldowns.json'):null;
    const support=owned&&supportRoutes.includes(place.path)?await readSnapshot('data/support-pages.json'):null;
    const reportHub=owned&&place.path==='/reports/'?await readSnapshot('data/report-hub-'+place.role+'.json'):null;
    const staffReport=owned&&place.path.startsWith('/reports/')&&place.path!=='/reports/'&&(place.role==='csr'||staffReportNames.includes(place.path.split('/')[2]));
    const staffReports=staffReport&&place.role==='company_admin'?await readSnapshot('data/staff-reports.json'):null;
    const lunch=owned&&place.path.startsWith('/schedule/lunch-overrides/')?await readSnapshot('data/lunch.json'):null;
    const invoices=owned&&['/invoices/','/payments/','/billing/'].includes(place.path)?await readSnapshot('data/invoices-'+place.role+'.json'):null;
    const payments=owned&&['/payments/','/billing/'].includes(place.path)?await readSnapshot('data/payments-'+place.role+'.json'):null;
    const resourceKind = /^\/(job-types|pricebook|inventory|equipment)\/$/.exec(place.path)?.[1];
    const resourcesData = owned && resourceKind ? await readSnapshot('data/resources-' + place.role + '.json') : null;
    const treatmentRoute=place.path.startsWith('/settings/job-types/');
    const settingsData = owned && (settingRoutes.includes(place.path)||treatmentRoute) ? await readSnapshot('data/settings-' + place.role + '.json') : null;
    if (current !== generation) return;
    dispose();
    document.querySelectorAll('dialog.dialog').forEach(node => node.close());
    const accountName = catalog.accounts[catalog.defaultAccounts[place.role]]?.name || '';
    const navItems = catalog.menus[place.role] || [];
    const menu = el('nav', { 'aria-label': '管理メニュー', class: 'menu' });
    menu.append(roleNavigation(catalog, place));
    let group = '';
    navItems.forEach(item => {
      if (group !== item.group) { group = item.group; menu.append(el('div', { class: 'menu-group', text: group })); }
      menu.append(el('a', { href: routeHash(place.role,item.route), class: item.route === place.path ? 'active' : '', ...(item.route === place.path ? { 'aria-current': 'page' } : {}) }, icon(menuIcons[item.route] || 'circle'), el('span', { text: item.label })));
    });
    const sidebar = el('aside', { class: 'sidebar' }, el('div', { class: 'brand' }, el('img', { src: './brand.svg', alt: 'SUKIMAKUN' }), sidebarClose(() => { sidebar.classList.remove('open'); hamburger.setAttribute('aria-expanded', 'false'); })), menu,
      el('footer', {}, el('span', { text: accountName }), button(icon('sign-out-alt'), () => notice('確認用デモのため、実際のログアウトは行いません。'), { class: 'logout', 'aria-label': 'ログアウト' })));
    const view = owned ? (place.path==='/business-manager/'&&place.role!=='company_admin'?accessDeniedView(place.path,place.role,['company_admin']):inbox ? inboxView(inbox) : dashboard ? dashboardView(dashboard) : routing ? routingView(routing,place.path) : routes ? routesView(routes) : bi ? biView(bi) : csrDashboard ? csrDashboardView(csrDashboard) : contractDocuments ? contractDocumentsView(contractDocuments) : contracts ? contractsView(contracts) : maintenance ? maintenanceView(maintenance) : business ? businessView(business,place.role) : chat ? chatView(chat,place.query) : calendar ? calendarView(calendar,data) : fieldJob ? fieldJobView(fieldJob,place.query.get('appt')) : myDay ? myDayView(myDay) : users ? usersView(users) : staff ? (place.path==='/tech-team/'?teamView(staff):liveStaffView(staff)) : myLeads ? myLeadsView(myLeads) : workforce ? workforceView(workforce,place.path) : leaderboard ? leaderboardView(leaderboard) : contest ? contestsView(contest,place.role) : tickets ? ticketsView(tickets) : leads ? leadsView(leads) : jobLogs ? jobLogsView(jobLogs,place.role) : engagement ? engagementView(engagement,place.path) : utilities ? utilitiesView(utilities,place.path,place.role) : communications ? communicationsView(communications,place.path) : drilldowns ? drilldownView(drilldowns,place.path,place.role) : support ? supportPagesView(support,place.path,place.role) : reportHub ? reportHubView(reportHub,place.role) : staffReport ? staffReportsView(staffReports,place.path,place.role) : compliance ? complianceView(compliance,place.path) : adminTools ? adminToolsView(adminTools,place.path) : rootSettings ? rootSettingsView(rootSettings,place.role,place.query) : lunch ? lunchView(lunch,place.path.split('/')[3]) : place.path==='/settings/'&&place.role!=='company_admin' ? accessDeniedView(place.path,place.role,['company_admin']) : financeSettings ? financeSettingsView(financeSettings,place.path,place.role,place.query) : disputes ? disputesView(disputes,place.path,place.role) : billing ? billingView(billing,invoices,payments,place.role,place.path) : payments ? paymentsView(payments,invoices,place.role,place.query) : invoices ? invoicesView(invoices,place.query) : customerMatch ? customerDetailView(customersData,histories,customerMatch[1],place.role) : treatmentRoute ? treatmentView(settingsData,place.path,place.role) : settingsData ? settingsView(settingsData,place.path,place.role) : resourceKind ? resourcesView(resourcesData,resourceKind) : locationMatch ? locationsView(locationData,locationMatch[1],place.role) : place.path === '/customers/' ? customersView(customersData,place.role,place.query) : place.path === '/reminders/' ? remindersView(data) : place.path === '/notifications/' ? notificationsView(notificationData,catalog,place.role) : bookingsView(data, place.query)) : null;
    app.classList.toggle('workspace-app',Boolean(view?.workspace));
    if(view?.workspace){const frame=workspaceFrame(view,place,accountName,catalog);app.replaceChildren(...frame.nodes);view.mount();dispose=()=>frame.dispose();document.title=view.title+'｜SUKIMAKUN';return;}
    const title = view?.title || (place.path === '/notifications/' ? '通知' : navItems.find(item => item.route === place.path)?.label || '予約一覧');
    const hamburger = button(icon('bars'), () => { const open = sidebar.classList.toggle('open'); hamburger.setAttribute('aria-expanded', String(open)); }, { class: 'hamburger', 'aria-label': 'メニュー', 'aria-expanded': 'false' });
    let closePopover = null;
    const bell = button([icon('bell'), el('span', { class: 'notification-count', text: data ? (data.notifications.count > 99 ? '99+' : data.notifications.count) : '' })], () => {
      if (closePopover && bell.getAttribute('aria-expanded') === 'true') { closePopover(); closePopover = null; }
      else closePopover = notificationPopover(bell, place.role);
    }, { class: 'bell', 'aria-label': '通知', 'aria-expanded':'false', disabled: !data });
    const header = el('header', { class: 'page-header ' + (view?.headerClass||'') + (view?.compactHeader ? ' settings-header' : '') + (place.path === '/reminders/' ? ' reminders-header' : '') }, hamburger, el('h1', {}, icon(view?.titleIcon || (['/reminders/','/notifications/'].includes(place.path) ? 'bell' : 'clipboard-list')), view?.heading || ' ' + title),
      view?.headerExtra,
      view?.add ? button([icon('plus'), ' '+(view.addLabel || '予約を追加')], () => view.add(), { class: 'primary add-booking' }) : null,
      bell);
    const pending = el('section', { class: 'migration-notice' }, el('h2', { text: canOpen(catalog,place) ? 'この画面は移行作業中です' : 'この役割では予約一覧を利用できません' }),
      el('p', { text: 'このローカル版は独自実装の動作比較用です。公開中の既存画面と全機能は保持されています。' }));
    app.replaceChildren(sidebar, el('main', {'data-route':place.role+'|'+place.path,'data-query':place.query.toString()}, place.role==='csr'&&contracts?el('a',{class:'contract-documents-link',href:routeHash('csr','/contracts/documents/'),text:'契約PDF・署名情報を確認'}):null, header, view?.node || pending));
    view?.mount(); dispose = () => { closePopover?.(); view?.dispose(); };
    document.title = title + '｜SUKIMAKUN';
  } catch (error) {
    if (current === generation) { dispose(); app.replaceChildren(el('p', { role: 'alert', class: 'fatal', text: '表示できませんでした：' + error.message })); }
  }
}
addEventListener('hashchange', render);
render();
