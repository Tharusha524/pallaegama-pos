import React, { useMemo } from 'react';
import {
  Box,
  Grid,
  Typography,
  Card,
  CardContent,
  Stack,
  Chip,
  alpha,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Alert,
  Button,
  Tooltip,
} from '@mui/material';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import StatCard from '../../components/StatCard';
import CustomPieChart from '../../components/CustomPieChart';
import DashboardAlertList from '../../components/Dashboard/DashboardAlertList';
import PageLoader from '../../components/PageLoader';
import useCurrentUser from '../../hooks/useCurrentUser';
import { useTimeBasedGreeting } from '../../hooks/useTimeBasedGreeting';
import { useHomeCurrency } from '../../hooks/useHomeCurrency';
import { useCurrentOrganization } from '../../utils/index.html';
import { getDashboardSummary } from '../../api/Dashboard/DashboardApi';
import { getSupermarketDashboardSummary } from '../../api/Pos/posApi';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import ReceiptIcon from '@mui/icons-material/Receipt';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import LocalMallIcon from '@mui/icons-material/LocalMall';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PaymentsIcon from '@mui/icons-material/Payments';
import FactoryIcon from '@mui/icons-material/Factory';
import FolderIcon from '@mui/icons-material/Folder';
import ScienceIcon from '@mui/icons-material/Science';
import EmergencyIcon from '@mui/icons-material/Emergency';
import ChangeHistoryIcon from '@mui/icons-material/ChangeHistory';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import AssessmentIcon from '@mui/icons-material/Assessment';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import AddIcon from '@mui/icons-material/Add';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import './Dashboard.css';

const PRIMARY = '#024271';
const CHART_COLORS = ['#024271', '#10b981', '#f59e0b', '#6366f1', '#ef4444', '#8b5cf6'];

const moduleLinks = [
  { title: 'Sales', description: 'Orders, invoices & payments', href: '/sales/transactions', icon: <ShoppingCartIcon />, color: '#1976d2' },
  { title: 'Purchase', description: 'POs, GRN & supplier payments', href: '/purchase/transactions', icon: <LocalMallIcon />, color: '#2e7d32' },
  { title: 'Items & Inventory', description: 'Stock, transfers & adjustments', href: '/itemsandinventory/transactions', icon: <FolderIcon />, color: '#ed6c02' },
  { title: 'Manufacturing', description: 'Work orders & production', href: '/manufacturing/transactions', icon: <ScienceIcon />, color: '#7b1fa2' },
  { title: 'Fixed Assets', description: 'Asset register & depreciation', href: '/fixedassets/transactions', icon: <EmergencyIcon />, color: '#c62828' },
  { title: 'CostCenter', description: 'Cost centres & projects', href: '/costCenter/transactions', icon: <ChangeHistoryIcon />, color: '#00838f' },
  { title: 'Banking & GL', description: 'Payments, journals & accounts', href: '/bankingandgeneralledger/transactions', icon: <PeopleAltIcon />, color: PRIMARY },
  { title: 'Setup', description: 'Company, users & chart of accounts', href: '/setup/companysetup', icon: <SettingsOutlinedIcon />, color: '#546e7a' },
];

const reportLinks = [
  { title: 'Trial Balance', href: '/bankingandgeneralledger/inquiriesandreports/trial-balance', icon: <AssessmentIcon /> },
  { title: 'Balance Sheet', href: '/bankingandgeneralledger/inquiriesandreports/balance-sheet-drilldown', icon: <AccountBalanceIcon /> },
  { title: 'Profit & Loss', href: '/bankingandgeneralledger/inquiriesandreports/profit-and-loss-drilldown', icon: <ShowChartIcon /> },
  { title: 'Journal Inquiry', href: '/bankingandgeneralledger/inquiriesandreports/journal-inquiry', icon: <MenuBookIcon /> },
];

const quickActions = [
  { title: 'Journal Entry', href: '/bankingandgeneralledger/transactions/journal-entry', icon: <AddIcon /> },
  { title: 'Customer Invoice', href: '/sales/transactions/direct-invoice', icon: <ReceiptLongIcon /> },
  { title: 'Payment', href: '/bankingandgeneralledger/transactions/payments', icon: <PaymentsIcon /> },
];

const statusColor: Record<string, 'success' | 'warning' | 'default'> = {
  Posted: 'success',
  Pending: 'warning',
  Draft: 'default',
};

function activityIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes('sales') || t.includes('invoice') || t.includes('customer')) {
    return <ShoppingCartIcon sx={{ color: alpha(PRIMARY, 0.75), fontSize: 22 }} />;
  }
  if (t.includes('purchase') || t.includes('supplier')) {
    return <LocalMallIcon sx={{ color: alpha('#2e7d32', 0.85), fontSize: 22 }} />;
  }
  if (t.includes('payment') || t.includes('bank')) {
    return <PaymentsIcon sx={{ color: alpha('#6366f1', 0.85), fontSize: 22 }} />;
  }
  if (t.includes('journal') || t.includes('gl')) {
    return <MenuBookIcon sx={{ color: alpha(PRIMARY, 0.75), fontSize: 22 }} />;
  }
  return <FactoryIcon sx={{ color: alpha(PRIMARY, 0.7), fontSize: 22 }} />;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const { organizationName } = useCurrentOrganization();
  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: getDashboardSummary,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  });
  const { data: supermarketSummary } = useQuery({
    queryKey: ['supermarket-dashboard-summary'],
    queryFn: getSupermarketDashboardSummary,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
  const { greeting, localTimeLabel, sriLankaDateLabel } = useTimeBasedGreeting(data?.server_now_utc);
  const { code: currencyCode, name: currencyName, formatCurrency } = useHomeCurrency();

  const formatAmount = (value: number | null) => {
    if (value === null || value === undefined) return '—';
    return formatCurrency(value);
  };

  const displayName = useMemo(() => {
    if (user?.first_name) return user.first_name;
    if (user?.email) return user.email.split('@')[0];
    return 'there';
  }, [user]);

  const salesChange = data?.kpis.sales_mtd.change ?? 0;
  const salesChipLabel =
    salesChange >= 0
      ? `Sales up ${Math.abs(salesChange)}% vs last month`
      : `Sales down ${Math.abs(salesChange)}% vs last month`;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-alerts'] });
  };

  if (isLoading) {
    return <PageLoader />;
  }

  if (isError || !data) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">
          Failed to load dashboard data. {(error as Error)?.message || 'Please ensure the backend is running.'}
        </Alert>
      </Box>
    );
  }

  const {
    kpis,
    sales_vs_purchases: salesVsPurchasesData,
    module_distribution: moduleDistribution,
    cash_flow: cashFlowData,
    recent_activity: recentActivity,
    alerts,
    period,
  } = data;

  const netWorking = kpis.receivables.value - kpis.payables.value;

  return (
    <Box className="erp-dashboard" sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      {/* Hero */}
      <Card elevation={0} className="erp-dashboard__hero" sx={{ mb: 2.5 }}>
        <CardContent className="erp-dashboard__hero-content" sx={{ p: { xs: 2.5, md: 3.5 } }}>
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', lg: 'center' }}
            spacing={2.5}
          >
            <Box sx={{ flex: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
                <Typography variant="overline" sx={{ opacity: 0.85, letterSpacing: 1.4, fontWeight: 700 }}>
                  {organizationName}
                </Typography>
                {alerts.length > 0 ? (
                  <Chip
                    size="small"
                    icon={<WarningAmberIcon />}
                    label={`${alerts.length} alert${alerts.length === 1 ? '' : 's'} need attention`}
                    sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 700, border: '1px solid rgba(245,158,11,0.35)' }}
                  />
                ) : (
                  <Chip
                    size="small"
                    icon={<CheckCircleOutlineIcon />}
                    label="All clear"
                    sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 600 }}
                  />
                )}
              </Stack>
              <Typography
                variant="h4"
                sx={{ fontWeight: 800, letterSpacing: '-0.03em', mt: 0.5, fontSize: { xs: '1.6rem', md: '2rem' } }}
              >
                {greeting}, {displayName}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.88, mt: 1, maxWidth: 640 }}>
                {sriLankaDateLabel} · {localTimeLabel} (Sri Lanka Time)
                {' · '}Live data as at {data.as_at}
                {period?.fiscal_year_label
                  ? ` · ${period.fiscal_year_label} (${period.fiscal_year_from} to ${period.fiscal_year_to})`
                  : ''}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Tooltip title="Refresh dashboard">
                <IconButton
                  onClick={handleRefresh}
                  disabled={isFetching}
                  sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
                  aria-label="Refresh dashboard"
                >
                  <RefreshIcon sx={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
                </IconButton>
              </Tooltip>
              {quickActions.map((action) => (
                <Button
                  key={action.title}
                  size="small"
                  variant="contained"
                  startIcon={action.icon}
                  onClick={() => navigate(action.href)}
                  sx={{
                    bgcolor: "background.paper",
                    color: PRIMARY,
                    fontWeight: 700,
                    '&:hover': { bgcolor: alpha('#fff', 0.9) },
                  }}
                >
                  {action.title}
                </Button>
              ))}
            </Stack>
          </Stack>

          <Grid container spacing={2} sx={{ mt: 2.5 }}>
            {[
              { label: 'Receivables', value: formatCurrency(kpis.receivables.value) },
              { label: 'Payables', value: formatCurrency(kpis.payables.value) },
              { label: 'Net AR − AP', value: formatCurrency(netWorking) },
              { label: 'Bank Balance', value: formatCurrency(kpis.bank_balance.value) },
            ].map((item) => (
              <Grid item xs={6} md={3} key={item.label}>
                <Box className="erp-dashboard__hero-metric">
                  <Typography variant="caption" sx={{ opacity: 0.75, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {item.label}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, mt: 0.25, letterSpacing: '-0.02em' }}>
                    {item.value}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Alerts banner */}
      {alerts.length > 0 && (
        <Card elevation={0} className="erp-dashboard__alerts-banner" sx={{ mb: 2.5 }}>
          <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <WarningAmberIcon sx={{ color: '#d97706' }} />
              <Typography variant="subtitle1" fontWeight={700} color="#92400e">
                Alerts & Reminders
              </Typography>
              <Chip label={alerts.length} size="small" color="warning" sx={{ height: 22, fontWeight: 700 }} />
            </Stack>
            <DashboardAlertList alerts={alerts} onNavigate={navigate} compact />
          </CardContent>
        </Card>
      )}

      {/* Report Strip */}
      <Box className="erp-dashboard__report-strip" sx={{ mb: 2.5, bgcolor: "background.paper" }}>
        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1, display: 'block' }}>
          Financial reports
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {reportLinks.map((report) => (
            <Button
              key={report.title}
              variant="outlined"
              size="small"
              startIcon={report.icon}
              onClick={() => navigate(report.href)}
              className="erp-dashboard__report-btn"
            >
              {report.title}
            </Button>
          ))}
        </Stack>
      </Box>

      <Box sx={{ mb: 2.5 }}>
        <Typography className="erp-dashboard__section-title">Key Performance Indicators</Typography>
        <Typography className="erp-dashboard__section-subtitle">
          Month-to-date figures in {currencyCode} · tap a card to open related inquiry
        </Typography>
      </Box>

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatCard
            title="Sales (MTD)"
            value={formatCurrency(kpis.sales_mtd.value)}
            change={kpis.sales_mtd.change}
            icon={<ShoppingCartIcon />}
            iconColor="#1976d2"
            subtitle="vs last month"
            onClick={() => navigate('/sales/inquiriesandreports/customer-transaction-inquiry')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatCard
            title="Purchases (MTD)"
            value={formatCurrency(kpis.purchases_mtd.value)}
            change={kpis.purchases_mtd.change}
            icon={<LocalMallIcon />}
            iconColor="#2e7d32"
            subtitle="vs last month"
            onClick={() => navigate('/purchase/inquiriesandreports/supplier-transaction-inquiry')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatCard
            title="Receivables"
            value={formatCurrency(kpis.receivables.value)}
            change={kpis.receivables.change}
            icon={<ReceiptLongIcon />}
            iconColor="#6366f1"
            subtitle="outstanding"
            onClick={() => navigate('/sales/inquiriesandreports/customer-allocation-inquiry')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatCard
            title="Payables"
            value={formatCurrency(kpis.payables.value)}
            change={kpis.payables.change}
            icon={<PaymentsIcon />}
            iconColor="#f59e0b"
            subtitle="outstanding"
            onClick={() => navigate('/purchase/inquiriesandreports/supplier-allocation-inquiry')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatCard
            title="Inventory Value"
            value={formatCurrency(kpis.inventory_value.value)}
            change={kpis.inventory_value.change}
            icon={<Inventory2Icon />}
            iconColor="#ed6c02"
            subtitle="at cost"
            onClick={() => navigate('/itemsandinventory/inquiriesandreports/inventory-item-status')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatCard
            title="Bank Balance"
            value={formatCurrency(kpis.bank_balance.value)}
            change={kpis.bank_balance.change}
            icon={<AccountBalanceIcon />}
            iconColor={PRIMARY}
            subtitle="all accounts"
            onClick={() => navigate('/bankingandgeneralledger/inquiriesandreports/bank-account-inquiry')}
          />
        </Grid>
      </Grid>

      {supermarketSummary && (
        <Box sx={{ mb: 3 }}>
          <Typography className="erp-dashboard__section-title">Today at the Supermarket</Typography>
          <Typography className="erp-dashboard__section-subtitle" sx={{ mb: 1.5 }}>
            Live POS / loyalty snapshot
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Card elevation={0} className="erp-dashboard__card" sx={{ cursor: 'pointer' }} onClick={() => navigate('/supermarket/sales-analytics')}>
                <CardContent sx={{ p: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <ReceiptIcon fontSize="small" sx={{ color: PRIMARY }} />
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>TODAY'S SALES</Typography>
                  </Stack>
                  <Typography variant="h6" fontWeight={800}>{formatCurrency(supermarketSummary.today_sales)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card elevation={0} className="erp-dashboard__card" sx={{ cursor: 'pointer' }} onClick={() => navigate('/supermarket/sales-analytics')}>
                <CardContent sx={{ p: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <ReceiptLongIcon fontSize="small" sx={{ color: PRIMARY }} />
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>BILLS ISSUED TODAY</Typography>
                  </Stack>
                  <Typography variant="h6" fontWeight={800}>{supermarketSummary.bills_issued_today}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card elevation={0} className="erp-dashboard__card" sx={{ cursor: 'pointer' }} onClick={() => navigate('/supermarket/low-stock')}>
                <CardContent sx={{ p: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <WarningAmberOutlinedIcon fontSize="small" sx={{ color: '#f59e0b' }} />
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>LOW STOCK ITEMS</Typography>
                  </Stack>
                  <Typography variant="h6" fontWeight={800}>{supermarketSummary.low_stock_count}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card elevation={0} className="erp-dashboard__card" sx={{ cursor: 'pointer' }} onClick={() => navigate('/supermarket')}>
                <CardContent sx={{ p: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <AccountBalanceIcon fontSize="small" sx={{ color: PRIMARY }} />
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>DEBTORS / CREDITORS</Typography>
                  </Stack>
                  <Typography variant="body2" fontWeight={700}>
                    {formatCurrency(supermarketSummary.total_debtors_outstanding)} / {formatCurrency(supermarketSummary.total_creditors_payable)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} lg={8}>
          <Card elevation={0} className="erp-dashboard__card">
            <CardContent sx={{ p: 3 }}>
              <Box className="erp-dashboard__card-header">
                <Box>
                  <Typography className="erp-dashboard__section-title">Sales vs Purchases</Typography>
                  <Typography className="erp-dashboard__section-subtitle">
                    Monthly comparison for active fiscal year
                    {period?.fiscal_report_start && period?.fiscal_report_end
                      ? ` (${period.fiscal_report_start} to ${period.fiscal_report_end})`
                      : ''}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    icon={salesChange >= 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
                    label={salesChipLabel}
                    size="small"
                    color={salesChange >= 0 ? 'success' : 'error'}
                    variant="outlined"
                  />
                  <Box 
                    component="span" 
                    className="erp-dashboard__card-badge"
                    sx={{
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(2, 66, 113, 0.2)' : 'rgba(2, 66, 113, 0.08)',
                      color: (theme) => theme.palette.mode === 'dark' ? '#60a5fa' : '#024271'
                    }}
                  >
                    Analytics
                  </Box>
                </Stack>
              </Box>
              {salesVsPurchasesData.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 8, textAlign: 'center' }}>
                  No sales or purchase data for this period yet.
                </Typography>
              ) : (
                <Box sx={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesVsPurchasesData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={8} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <RechartsTooltip
                        cursor={{ fill: alpha(PRIMARY, 0.06) }}
                        contentStyle={{
                          borderRadius: 12,
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.08)',
                        }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: 16 }} />
                      <Bar dataKey="sales" name="Sales" fill={PRIMARY} radius={[6, 6, 0, 0]} barSize={22} />
                      <Bar dataKey="purchases" name="Purchases" fill="#94a3b8" radius={[6, 6, 0, 0]} barSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Card elevation={0} className="erp-dashboard__card">
            <CardContent sx={{ p: 3 }}>
              <Box className="erp-dashboard__card-header">
                <Box>
                  <Typography className="erp-dashboard__section-title">Transactions by Module</Typography>
                  <Typography className="erp-dashboard__section-subtitle">This month</Typography>
                </Box>
                <Box 
                  component="span" 
                  className="erp-dashboard__card-badge"
                  sx={{
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(2, 66, 113, 0.2)' : 'rgba(2, 66, 113, 0.08)',
                    color: (theme) => theme.palette.mode === 'dark' ? '#60a5fa' : '#024271'
                  }}
                >
                  Distribution
                </Box>
              </Box>
              {moduleDistribution.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 8, textAlign: 'center' }}>
                  No transactions recorded this month.
                </Typography>
              ) : (
                <CustomPieChart
                  data={moduleDistribution}
                  width="100%"
                  height={300}
                  innerRadius={65}
                  outerRadius={95}
                  colors={CHART_COLORS}
                />
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} md={7}>
          <Card elevation={0} className="erp-dashboard__card">
            <CardContent sx={{ p: 3 }}>
              <Typography className="erp-dashboard__section-title" sx={{ mb: 0.5 }}>
                Cash Flow Trend
              </Typography>
              <Typography className="erp-dashboard__section-subtitle" sx={{ mb: 2 }}>
                Weekly bank inflow vs outflow
              </Typography>
              {cashFlowData.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                  No bank transactions in the last 4 weeks.
                </Typography>
              ) : (
                <Box sx={{ width: '100%', height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cashFlowData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <RechartsTooltip
                        contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Area type="monotone" dataKey="inflow" stroke="#10b981" fill="url(#inflowGrad)" strokeWidth={2} name="Inflow" />
                      <Area type="monotone" dataKey="outflow" stroke="#ef4444" fill="url(#outflowGrad)" strokeWidth={2} name="Outflow" />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card elevation={0} className="erp-dashboard__card">
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              <Box sx={{ px: 3, pt: 3, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography className="erp-dashboard__section-title">Recent Activity</Typography>
                  <Typography className="erp-dashboard__section-subtitle">
                    Latest transactions across modules
                  </Typography>
                </Box>
                <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/bankingandgeneralledger/inquiriesandreports/journal-inquiry')}>
                  View all
                </Button>
              </Box>
              {recentActivity.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ px: 3, pb: 3 }}>
                  No recent transactions found.
                </Typography>
              ) : (
                <List disablePadding>
                  {recentActivity.map((item, index) => (
                    <React.Fragment key={item.id}>
                      <ListItem sx={{ px: 3, py: 1.25 }}>
                        <ListItemIcon sx={{ minWidth: 40 }}>
                          {activityIcon(item.type)}
                        </ListItemIcon>
                        <ListItemText
                          slotProps={{ secondary: { component: 'div' } }}
                          primary={
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: '55%' }}>
                                {item.ref}
                              </Typography>
                              <Typography variant="body2" fontWeight={600} color="text.primary">
                                {formatAmount(item.amount)}
                              </Typography>
                            </Stack>
                          }
                          secondary={
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.25 }}>
                              <Typography variant="caption" color="text.secondary">
                                {item.type}
                              </Typography>
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <Chip
                                  label={item.status}
                                  size="small"
                                  color={statusColor[item.status] ?? 'default'}
                                  sx={{ height: 20, fontSize: '0.65rem' }}
                                />
                                <Typography variant="caption" color="text.disabled">
                                  {item.time}
                                </Typography>
                              </Stack>
                            </Stack>
                          }
                        />
                      </ListItem>
                      {index < recentActivity.length - 1 && <Divider component="li" />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Box>
            <Typography className="erp-dashboard__section-title">Quick Access</Typography>
            <Typography className="erp-dashboard__section-subtitle">Jump to any ERP module</Typography>
          </Box>
          <Chip label={`${currencyCode} · ${currencyName}`} size="small" variant="outlined" />
        </Stack>
        <Grid container spacing={2}>
          {moduleLinks.map((mod) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={mod.title}>
              <Card
                elevation={0}
                className="erp-dashboard__quick-card"
                sx={{
                  bgcolor: "background.paper",
                  '&:hover': {
                    borderColor: alpha(mod.color, 0.5),
                    boxShadow: `0 8px 24px ${alpha(mod.color, 0.12)}`,
                  },
                }}
              >
                <ListItemButton onClick={() => navigate(mod.href)} sx={{ p: 2.5, borderRadius: 3 }}>
                  <ListItemIcon sx={{ minWidth: 48 }}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: alpha(mod.color, 0.1),
                        color: mod.color,
                      }}
                    >
                      {React.cloneElement(mod.icon, { fontSize: 'medium' })}
                    </Box>
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="subtitle2" fontWeight={700} color="text.primary">
                        {mod.title}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                        {mod.description}
                      </Typography>
                    }
                  />
                  <IconButton size="small" sx={{ color: 'text.disabled' }} aria-label={`Open ${mod.title}`}>
                    <ArrowForwardIcon fontSize="small" />
                  </IconButton>
                </ListItemButton>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Box>
  );
};

export default Dashboard;
