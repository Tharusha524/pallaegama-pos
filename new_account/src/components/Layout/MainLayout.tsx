import * as React from "react";
import { styled, useTheme, Theme, CSSObject } from "@mui/material/styles";
import Box from "@mui/material/Box";
import MuiDrawer from "@mui/material/Drawer";
import MuiAppBar, { AppBarProps as MuiAppBarProps } from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import List from "@mui/material/List";
import CssBaseline from "@mui/material/CssBaseline";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ListItem from "@mui/material/ListItem";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import {
  Alert,
  Button,
  Collapse,
  Drawer as MobileDrawer,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  useMediaQuery,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { Link, useLocation, useNavigate } from "react-router";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import NotificationCenter from "../NotificationCenter";
import { APP_ROUTER_BASENAME } from "../../config/appConfig";
import { getActiveFiscalYear } from "../../api/FiscalYear/activeFiscalYearApi";
import { getPageMetaFromPath } from "../../utils/pageMeta";
import { SidebarItem, getSidebarItems } from "./SidebarItems";
import { useCompanySetupSettings } from "../../hooks/useCompanySetupSettings";
import { useAuth } from "../../context/AuthContext";
import { getModulePermissionIds } from "../../permissions/navigationTree";
import theme from "../../theme";
import useIsMobile from "../../customHooks/useIsMobile";
import LogoutIcon from "@mui/icons-material/Logout";
import DeleteConfirmationModal from "../DeleteConfirmationModal";
import { useMemo, useState } from "react";
import { notify } from "../../services/notificationService";
import { PermissionKeysObject } from "../../views/Administration/SectionList";
import useCurrentUser from "../../hooks/useCurrentUser";
import "./MainLayout.css";
import ViewUserContent from "../../views/Administration/ViewUserProfileContent";
import ViewProfileDataDrawer, {
  DrawerProfileHeader,
} from "../ViewProfileDataDrawer";
import ProfileImage from "../ProfileImageComponent";
import { useQuery } from "@tanstack/react-query";
import { getOrganization } from "../../api/OrganizationSettings/organizationSettingsApi";
import { resolveLogoSrc } from "../../utils/logoUrl";
import { useUIStore } from "../../store/uiStore";
import growLedgerLogo from "../../assets/group-logo.svg";
import HelpFloatingButton from "../Help/HelpFloatingButton";
import { useThemeContext } from "../../context/ThemeContext";

const drawerWidth = 288;
const collapsedDrawerWidth = 76;

const openedMixin = (theme: Theme): CSSObject => ({
  width: drawerWidth,
  transition: theme.transitions.create("width", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: "hidden",
});

const closedMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create("width", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: "hidden",
  width: collapsedDrawerWidth,
});

const DrawerHeader = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
}));

interface AppBarProps extends MuiAppBarProps {
  open?: boolean;
}

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== "open",
})<AppBarProps>(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
  zIndex: theme.zIndex.drawer + 1,
  transition: theme.transitions.create(["width", "margin"], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  variants: [
    {
      props: ({ open }) => open,
      style: {
        marginLeft: drawerWidth,
        width: `calc(100% - ${drawerWidth}px)`,
        transition: theme.transitions.create(["width", "margin"], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
      },
    },
    {
      props: ({ open }) => !open,
      style: {
        marginLeft: collapsedDrawerWidth,
        width: `calc(100% - ${collapsedDrawerWidth}px)`,
      },
    },
  ],
  [theme.breakpoints.down("md")]: {
    width: "100%",
    marginLeft: 0,
  },
}));

const Drawer = styled(MuiDrawer, {
  shouldForwardProp: (prop) => prop !== "open",
})(({ theme }) => ({
  width: drawerWidth,
  flexShrink: 0,
  whiteSpace: "nowrap",
  boxSizing: "border-box",
  variants: [
    {
      props: ({ open }) => open,
      style: {
        ...openedMixin(theme),
        "& .MuiDrawer-paper": openedMixin(theme),
      },
    },
    {
      props: ({ open }) => !open,
      style: {
        ...closedMixin(theme),
        "& .MuiDrawer-paper": closedMixin(theme),
      },
    },
  ],
}));

interface Props {
  children: JSX.Element | JSX.Element[];
}

export default function MainLayout({ children }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const open = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const { user } = useCurrentUser();
  const openViewProfileDrawer = useUIStore((s) => s.profileDrawerOpen);
  const setProfileDrawerOpen = useUIStore((s) => s.setProfileDrawerOpen);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const openEditUserRoleDialog = false; // Mock, adjust if this causes problems
  const [openEditUserRoleDialogState, setOpenEditUserRoleDialogState] = useState(false);
  const statusColor = user?.availability ? "#44b700" : "#f44336";
  const openProfileDrawer = () => setProfileDrawerOpen(true);
  const { mode, toggleColorMode } = useThemeContext();
  const { pathname } = useLocation();
  const pageMeta = useMemo(() => getPageMetaFromPath(pathname), [pathname]);

  const { data: activeFiscalYear } = useQuery({
    queryKey: ["active-fiscal-year"],
    queryFn: getActiveFiscalYear,
    staleTime: 5 * 60 * 1000,
  });

  const toggleDrawerOpen = () => {
    toggleSidebar();
  };

  const handleDrawerClose = () => {
    setSidebarOpen(false);
  };

  React.useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile, setSidebarOpen]);

  const { data: organizationData } = useQuery({
    queryKey: ["organization"],
    queryFn: getOrganization,
  });

  const logoEntry = useMemo(() => {
    if (organizationData && organizationData?.logoUrl) {
      return Array.isArray(organizationData.logoUrl)
        ? organizationData.logoUrl[0]
        : organizationData.logoUrl;
    }
    return undefined;
  }, [organizationData]);

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />

      <AppBar
        position="fixed"
        open={open}
        elevation={0}
        className="erp-navbar"
      >
        <Toolbar className="erp-navbar__toolbar">
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
              gap: 2,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", minWidth: 0, flex: 1 }}>
              <IconButton
                aria-label="open drawer"
                onClick={toggleDrawerOpen}
                edge="start"
                className="erp-navbar__menu-btn"
                sx={[open && !isMobile && { display: "none" }]}
              >
                <MenuIcon />
              </IconButton>

              <Box className="erp-navbar__page-meta">
                <Typography className="erp-navbar__page-title" noWrap>
                  {pageMeta.title}
                </Typography>
                <Typography className="erp-navbar__breadcrumb" noWrap>
                  {pageMeta.breadcrumb}
                </Typography>
              </Box>
            </Box>

            {!isMobile && (
              <Box className="erp-navbar__center">
                {activeFiscalYear?.label && (
                  <Box className="erp-navbar__pill">
                    <CalendarMonthOutlinedIcon sx={{ fontSize: 14 }} />
                    {activeFiscalYear.label}
                  </Box>
                )}
                <Box className="erp-navbar__pill">
                  <span className="erp-navbar__pill-dot" />
                  System Online
                </Box>
              </Box>
            )}

            <Box className="erp-navbar__actions">
              <IconButton onClick={toggleColorMode} color="inherit" sx={{ mr: 1 }}>
                {mode === 'dark' ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
              </IconButton>
              <NotificationCenter />

              <Box
                className="erp-navbar__profile"
                onClick={() => setProfileDrawerOpen(true)}
              >
                <Box sx={{ textAlign: "right", display: { xs: "none", sm: "block" } }}>
                  <Typography className="erp-navbar__profile-name" noWrap>
                    {user?.first_name} {user?.last_name}
                  </Typography>
                  <Typography className="erp-navbar__profile-role" noWrap>
                    {user?.role || "User"}
                  </Typography>
                </Box>
                <Box sx={{ position: "relative" }}>
                  <ProfileImage
                    name={user?.first_name}
                    imageUrl={
                      user?.image_url ??
                      user?.image ??
                      (user as any)?.imageUrl ??
                      (user as any)?.profile_image_url ??
                      (user as any)?.profile_image
                    }
                    files={user?.profileImage}
                    size="36px"
                  />
                  <Box
                    sx={{
                      position: "absolute",
                      bottom: 0,
                      right: 0,
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      backgroundColor: statusColor,
                      border: "2px solid #fff",
                    }}
                  />
                </Box>
              </Box>
            </Box>

            <ViewProfileDataDrawer
              open={openViewProfileDrawer}
              handleClose={() => setProfileDrawerOpen(false)}
              fullScreen
              drawerContent={
                <Stack spacing={1} sx={{ p: 1 }}>
                  <DrawerProfileHeader
                    title="User Profile"
                    handleClose={() => setProfileDrawerOpen(false)}
                    onEdit={() => setOpenEditUserRoleDialogState(true)}
                  />
                  <ViewUserContent selectedUser={user} />
                </Stack>
              }
            />
          </Box>
        </Toolbar>
      </AppBar>


      {isMobile ? (
        <MobileDrawer
          variant="temporary"
          open={open}
          onClose={handleDrawerClose}
          ModalProps={{ keepMounted: true }}
          PaperProps={{
            sx: {
              width: drawerWidth,
              borderRight: "none",
              boxShadow: "4px 0 32px rgba(15, 23, 42, 0.12)",
            },
          }}
        >
          <DrawerContent
            collapsed={!isMobile && !open}
            handleDrawerClose={handleDrawerClose}
            openProfileDrawer={openProfileDrawer}
            user={user}
            logoUrl={logoEntry ? resolveLogoSrc(logoEntry) : undefined}
            organizationName={organizationData?.organizationName}
          />
        </MobileDrawer>
      ) : (
        <Drawer
          variant="permanent"
          open={open}
          PaperProps={{
            sx: {
              width: open ? drawerWidth : collapsedDrawerWidth,
              borderRight: "none",
              boxShadow: "4px 0 32px rgba(15, 23, 42, 0.14)",
              transition: (t) =>
                t.transitions.create("width", {
                  easing: t.transitions.easing.sharp,
                  duration: open
                    ? t.transitions.duration.enteringScreen
                    : t.transitions.duration.leavingScreen,
                }),
              overflowX: "hidden",
            },
          }}
        >
          <DrawerContent
            collapsed={!open}
            handleDrawerClose={handleDrawerClose}
            openProfileDrawer={openProfileDrawer}
            user={user}
            logoUrl={logoEntry ? resolveLogoSrc(logoEntry) : undefined}
            organizationName={organizationData?.organizationName}
          />
        </Drawer>
      )}
      <Box component="main" sx={{ flexGrow: 1, }}>
        <DrawerHeader />
        {children}
        <HelpFloatingButton />
      </Box>
    </Box>
  );
}

const DrawerContent = ({
  collapsed = false,
  handleDrawerClose,
  openProfileDrawer,
  user,
  logoUrl,
  organizationName,
}: {
  collapsed?: boolean;
  handleDrawerClose: () => void;
  openProfileDrawer: () => void;
  user: any;
  logoUrl?: string;
  organizationName?: string;
}) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [navQuery, setNavQuery] = useState("");
  const [sidebarLogoSrc, setSidebarLogoSrc] = useState<string>(logoUrl || growLedgerLogo);
  const activeMainItem = useUIStore((s) => s.activeMainItem);
  const setActiveMainItem = useUIStore((s) => s.setActiveMainItem);

  const userPermissionObject = useMemo(() => {
    if (user && user?.permissionObject) {
      return user.permissionObject;
    }
  }, [user]);

  const { manufacturingEnabled, fixedAssetsEnabled, useCostCenters } =
    useCompanySetupSettings();
  const { hasPermission } = useAuth();

  const sidebarItems = useMemo(
    () =>
      getSidebarItems(
        getModulePermissionIds("Setup").some((id) => hasPermission(id)),
        {
          manufacturingEnabled,
          fixedAssetsEnabled,
          useCostCenters,
        },
        hasPermission
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.role, manufacturingEnabled, fixedAssetsEnabled, useCostCenters, hasPermission]
  );

  React.useEffect(() => {
    setSidebarLogoSrc(logoUrl || growLedgerLogo);
  }, [logoUrl]);

  const brandTitle = organizationName?.trim() || "Grow Ledger";

  const filteredSidebarItems = useMemo(() => {
    const q = navQuery.trim().toLowerCase();
    if (!q) return sidebarItems;

    return sidebarItems
      .map((item) => {
        if (item.headline) return item.headline.toLowerCase().includes(q) ? item : null;
        if (!item.nestedItems) {
          return item.title?.toLowerCase().includes(q) ? item : null;
        }

        const nested = item.nestedItems.filter((n) =>
          n.title.toLowerCase().includes(q)
        );
        if (item.title?.toLowerCase().includes(q) || nested.length > 0) {
          return { ...item, nestedItems: nested.length ? nested : item.nestedItems, open: true };
        }
        return null;
      })
      .filter(Boolean) as SidebarItem[];
  }, [navQuery, sidebarItems]);

  return (
    <Box className={`erp-sidebar${collapsed ? " erp-sidebar--collapsed" : ""}`}>
      <Box className="erp-sidebar__brand">
        <img
          src={sidebarLogoSrc}
          alt={logoUrl ? "Company logo" : "Grow Ledger logo"}
          className="erp-sidebar__brand-logo"
          onError={() => setSidebarLogoSrc(growLedgerLogo)}
        />
        <Box className="erp-sidebar__brand-text">
          <Typography className="erp-sidebar__brand-title" noWrap>
            {brandTitle}
          </Typography>
          <Typography className="erp-sidebar__brand-subtitle">Enterprise ERP</Typography>
        </Box>
        <IconButton
          className="erp-sidebar__brand-close"
          onClick={handleDrawerClose}
          size="small"
          sx={{
            color: "rgba(148,163,184,0.8)",
            "&:hover": { color: "#fff", backgroundColor: "rgba(255,255,255,0.06)" },
          }}
        >
          {theme.direction === "rtl" ? (
            <ChevronRightIcon fontSize="small" />
          ) : (
            <ChevronLeftIcon fontSize="small" />
          )}
        </IconButton>
      </Box>

      {!collapsed ? (
        <Box className="erp-sidebar__search">
          <TextField
            fullWidth
            size="small"
            placeholder="Search menu…"
            value={navQuery}
            onChange={(e) => setNavQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: "#64748b" }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>
      ) : null}

      <Box className="erp-sidebar__nav">
        {!collapsed ? (
          <Typography className="erp-sidebar__section-label">Main Navigation</Typography>
        ) : null}

        {navQuery && filteredSidebarItems.length === 0 ? (
          <Typography className="erp-nav-empty">No menu items match your search.</Typography>
        ) : null}

        {filteredSidebarItems.map((item, index) => {
          if (item?.accessKey && !userPermissionObject[`${item?.accessKey}`])
            return null;

          if (item?.headline) {
            return (
              <Typography key={item.headline} className="erp-sidebar__headline">
                {item.headline}
              </Typography>
            );
          }

          if (item.nestedItems) {
            return (
              <Box key={`${item.href}-${item.title}`} sx={{ px: "4px" }}>
                <NestedItem
                  item={item}
                  collapsed={collapsed}
                  pathname={pathname}
                  handleDrawerClose={handleDrawerClose}
                  userPermissionObject={userPermissionObject}
                  activeMainItem={activeMainItem}
                  setActiveMainItem={setActiveMainItem}
                  navigate={navigate}
                />
              </Box>
            );
          }

          return (
            <ListItem
              key={item.accessKey || item.href || index}
              disableGutters
              sx={{ paddingY: 0, px: "4px" }}
            >
              <LinkButton
                to={item.href}
                icon={item.icon}
                title={item.title}
                disabled={item.disabled}
                handleDrawerClose={handleDrawerClose}
                collapsed={collapsed}
              />
            </ListItem>
          );
        })}
      </Box>

      <Box className="erp-sidebar__footer">
        <Tooltip title={collapsed ? `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim() : ""} placement="right">
          <Box className="erp-sidebar__user-card" onClick={openProfileDrawer}>
            <ProfileImage
              name={user?.first_name}
              imageUrl={
                user?.image_url ?? user?.image ?? (user as any)?.imageUrl ?? (user as any)?.profile_image_url ?? (user as any)?.profile_image
              }
              files={user?.profileImage}
              size="2.5rem"
            />
            <Box className="erp-sidebar__user-meta" sx={{ minWidth: 0 }}>
              <Typography className="erp-sidebar__user-name" noWrap>
                {user?.first_name} {user?.last_name}
              </Typography>
              <Typography className="erp-sidebar__user-role" noWrap>
                {user?.role || "User"}
              </Typography>
            </Box>
          </Box>
        </Tooltip>

        <Tooltip title={collapsed ? "Sign out" : ""} placement="right">
          <Button
            fullWidth
            variant="outlined"
            className="erp-sidebar__logout-btn"
            startIcon={<LogoutIcon fontSize="small" />}
            onClick={() => setLogoutDialogOpen(true)}
            sx={collapsed ? { minWidth: 0, px: 1.25 } : undefined}
          >
            <span className="erp-sidebar__logout-label">Sign out</span>
          </Button>
        </Tooltip>

        {!collapsed ? (
          <Typography className="erp-sidebar__copyright">
            © {new Date().getFullYear()} {brandTitle}
          </Typography>
        ) : null}
      </Box>

      {logoutDialogOpen && (
        <DeleteConfirmationModal
          open={logoutDialogOpen}
          title="Log Out Confirmation"
          customDeleteButtonText="Log Out Now"
          customDeleteButtonIon={<LogoutIcon />}
          content={
            <>
              Are you sure you want to log out of the application?
              <Alert severity="warning" style={{ marginTop: "1rem" }}>
                You will be logged out of the application and will need to log in with credentials again to access your account.
              </Alert>
            </>
          }
          handleClose={() => setLogoutDialogOpen(false)}
          deleteFunc={async () => {
            notify.success("Logged out successfully");
            localStorage.removeItem("token");
            window.location.href = APP_ROUTER_BASENAME;
          }}
          onSuccess={() => {}}
          handleReject={() => setLogoutDialogOpen(false)}
        />
      )}
    </Box>
  );
};

const NestedItem = React.memo(
  ({
    item,
    collapsed = false,
    pathname,
    handleDrawerClose,
    userPermissionObject,
    activeMainItem,
    setActiveMainItem,
    navigate,
  }: {
    item: SidebarItem;
    collapsed?: boolean;
    pathname: string;
    handleDrawerClose: () => void;
    userPermissionObject: PermissionKeysObject;
    activeMainItem: string | null;
    setActiveMainItem: React.Dispatch<React.SetStateAction<string | null>>;
    navigate: ReturnType<typeof useNavigate>;
  }) => {
    const branchHasActiveRoute = React.useCallback(
      (items?: SidebarItem["nestedItems"]): boolean => {
        if (!items?.length) return false;
        return items.some((nestedItem) => {
          if (nestedItem.href && pathname.startsWith(nestedItem.href)) return true;
          return branchHasActiveRoute(nestedItem.nestedItems);
        });
      },
      [pathname]
    );

    const [open, setOpen] = React.useState(
      Boolean(item.open) || branchHasActiveRoute(item.nestedItems)
    );
    const { isTablet } = useIsMobile();

    React.useEffect(() => {
      if (branchHasActiveRoute(item.nestedItems)) {
        setOpen(true);
        setActiveMainItem(item.href || item.title);
      }
    }, [branchHasActiveRoute, item.href, item.nestedItems, item.title, setActiveMainItem]);

    const isMainItemActive = activeMainItem === (item.href || item.title);

    const isAllItemsHidden = useMemo(() => {
      const checkNestedItems = (nestedItems: SidebarItem["nestedItems"]) => {
        if (!nestedItems?.length) return true;
        return nestedItems.every((nestedItem) => {
          if (nestedItem.nestedItems) {
            return checkNestedItems(nestedItem.nestedItems);
          }
          return nestedItem?.accessKey && !userPermissionObject[nestedItem.accessKey];
        });
      };

      return checkNestedItems(item.nestedItems);
    }, [item.nestedItems, userPermissionObject]);

    if (isAllItemsHidden) return null;

    const parentButton = (
      <Button
        onClick={() => {
          if (collapsed && item.href) {
            navigate(item.href);
            handleDrawerClose();
            return;
          }
          if (item.nestedItems) {
            setOpen((o) => !o);
            setActiveMainItem(item.href || item.title);
          } else if (item.href) {
            navigate(item.href);
            handleDrawerClose();
          }
        }}
        className={`erp-nav-item ${isMainItemActive ? "erp-nav-item--parent-active" : ""}`}
        disabled={item.disabled}
      >
        <span className="erp-nav-item__icon-wrap">{item.icon}</span>
        <Typography className="erp-nav-item__title" variant="body2">
          {item.title}
        </Typography>
        {!collapsed ? (
          <ExpandMoreIcon
            className={`erp-nav-item__chevron${open ? " erp-nav-item__chevron--open" : ""}`}
            sx={{ fontSize: "1.1rem", ml: 0.5 }}
          />
        ) : null}
      </Button>
    );

    return (
      <React.Fragment key={item.accessKey || item.href}>
        {collapsed ? (
          <Tooltip title={item.title ?? ""} placement="right">
            <Box>{parentButton}</Box>
          </Tooltip>
        ) : (
          parentButton
        )}
        {!collapsed ? (
          <Collapse in={open} unmountOnExit>
            <List className="erp-nav-nested-list">
              {item.nestedItems?.map((nestedItem, index) => {
                if (nestedItem?.accessKey && !userPermissionObject[`${nestedItem?.accessKey}`])
                  return null;

                if (nestedItem.nestedItems) {
                  return (
                    <Box key={nestedItem.accessKey || nestedItem.href || index} sx={{ mt: "4px" }}>
                      <NestedItem
                        item={nestedItem}
                        collapsed={collapsed}
                        pathname={pathname}
                        handleDrawerClose={handleDrawerClose}
                        userPermissionObject={userPermissionObject}
                        activeMainItem={activeMainItem}
                        setActiveMainItem={setActiveMainItem}
                        navigate={navigate}
                      />
                    </Box>
                  );
                }

                return (
                  <ListItem
                    key={nestedItem.accessKey || nestedItem.href || index}
                    disableGutters
                    sx={{ paddingY: "2px" }}
                  >
                    <LinkButton
                      to={nestedItem.href}
                      icon={nestedItem.icon}
                      title={nestedItem.title}
                      disabled={nestedItem.disabled}
                      handleDrawerClose={handleDrawerClose}
                      isSubItem
                      collapsed={collapsed}
                    />
                  </ListItem>
                );
              })}
            </List>
          </Collapse>
        ) : null}
      </React.Fragment>
    );
  }
);

interface LinkButtonProps {
  to: string;
  icon: any;
  title: string;
  disabled?: boolean;
  handleDrawerClose: () => void;
  isSubItem?: boolean;
  collapsed?: boolean;
}

export const LinkButton = React.memo(
  ({ to, icon, title, disabled, handleDrawerClose, isSubItem, collapsed }: LinkButtonProps) => {
    const { pathname } = useLocation();
    const { isTablet } = useIsMobile();

    const isMatch = to === "/" ? pathname === to : pathname.startsWith(to);

    const button = (
      <Link
        to={to}
        style={{ width: "100%", display: "block" }}
        onClick={() => {
          if (isTablet) handleDrawerClose();
        }}
      >
        <Button
          className={`erp-nav-item ${isSubItem ? "erp-nav-item--sub" : ""} ${isMatch ? "erp-nav-item--active" : ""}`}
          disabled={disabled}
        >
          {icon ? (
            <span className="erp-nav-item__icon-wrap">{icon}</span>
          ) : isSubItem ? (
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                bgcolor: isMatch ? "#7dd3fc" : "rgba(148,163,184,0.5)",
                mr: 1.5,
                ml: 0.5,
                flexShrink: 0,
              }}
            />
          ) : null}
          <Typography className="erp-nav-item__title" variant="body2">
            {title}
          </Typography>
        </Button>
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip title={title} placement="right">
          <Box>{button}</Box>
        </Tooltip>
      );
    }

    return button;
  }
);