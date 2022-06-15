import { faBars } from "@fortawesome/free-solid-svg-icons";
import {
  Box,
  Collapse,
  Container,
  IconButton,
  Slide,
  Typography,
  useMediaQuery,
  useScrollTrigger,
  useTheme,
} from "@mui/material";
import clsx from "clsx";
import { useRouter } from "next/router";
import { useContext, useEffect, useMemo, useState, VFC } from "react";
import { unstable_batchedUpdates } from "react-dom";

import SiteMapContext from "../context/site-map-context";
import { useUser } from "../context/user-context";
import { SiteMapPage, SiteMapPageSection } from "../lib/sitemap";
import { HOME_PAGE_HEADER_HEIGHT } from "../pages/index.page";
import { BlockProtocolLogoIcon, FontAwesomeIcon } from "./icons";
import { Link } from "./link";
import { LinkButton } from "./link-button";
import { AccountDropdown } from "./navbar/account-dropdown";
import { MobileBreadcrumbs } from "./navbar/mobile-breadcrumbs";
import { MobileNavItems } from "./navbar/mobile-nav-items";
import { itemIsPage, NAVBAR_LINK_ICONS } from "./navbar/util";

export const DESKTOP_NAVBAR_HEIGHT = 71.5;

export const MOBILE_NAVBAR_HEIGHT = 57;

const BREAD_CRUMBS_HEIGHT = 36;

const IDLE_NAVBAR_TIMEOUT_MS = 3_000;

const findCrumbs = (params: {
  asPath: string;
  item: SiteMapPage | SiteMapPageSection;
  parents?: (SiteMapPage | SiteMapPageSection)[];
  parentHref?: string;
}): (SiteMapPage | SiteMapPageSection)[] | null => {
  const { parents, item, asPath, parentHref } = params;

  for (const section of itemIsPage(item) ? item.sections : item.subSections) {
    const crumbs = findCrumbs({
      asPath,
      item: section,
      parents: [...(parents || []), item],
      parentHref: itemIsPage(item) ? item.href : parentHref,
    });

    if (crumbs) {
      return crumbs;
    }
  }

  if (itemIsPage(item)) {
    for (const page of item.subPages) {
      const crumbs = findCrumbs({
        asPath,
        item: page,
        parents: [...(parents || []), item],
      });

      if (crumbs) {
        return crumbs;
      }
    }
  }

  const href = itemIsPage(item) ? item.href : `${parentHref}#${item.anchor}`;

  if (asPath === href || (itemIsPage(item) && asPath === `${href}#`)) {
    return [...(parents || []), item];
  }

  return null;
};

type NavbarProps = {
  openLoginModal: () => void;
};

const navbarClasses = {
  link: "Navbar-Link",
  interactiveLink: "Navbar-InteractiveLink",
};

const useCrumbs = (pages: SiteMapPage[]) => {
  const { asPath } = useRouter();

  return useMemo(() => {
    const breadCrumbPages = pages.filter(({ title }) =>
      ["Specification", "Documentation"].includes(title),
    );

    for (const page of breadCrumbPages) {
      const maybeCrumbs = findCrumbs({ asPath, item: page });
      if (maybeCrumbs) {
        return maybeCrumbs;
      }
    }
    return [];
  }, [asPath, pages]);
};

const useMobileNavVisible = (canDisplayMobileNav: boolean) => {
  const [mobileNavVisible, setMobileNavVisible] = useState(false);

  if (!canDisplayMobileNav && mobileNavVisible) {
    setMobileNavVisible(false);
  }

  return [mobileNavVisible, setMobileNavVisible] as const;
};

const useScrollingNavbar = (
  alwaysVisible: boolean,
  threshold: number | null,
  mobileNavVisible: boolean,
) => {
  const [navbarHiddenByIdle, setNavbarHiddenByIdle] = useState(false);

  const defaultScrolledPast = {
    0: false,
    ...(threshold !== null
      ? {
          [threshold * 0.5]: false,
          [threshold * 0.75]: false,
          [threshold]: false,
        }
      : {}),
  };
  const [scrolledPast, setScrolledPast] =
    useState<Record<string, boolean>>(defaultScrolledPast);

  if (threshold !== null && !Object.hasOwn(defaultScrolledPast, threshold)) {
    setScrolledPast(defaultScrolledPast);
  }

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined = undefined;
    const onScroll = () => {
      unstable_batchedUpdates(() => {
        setScrolledPast((currentValue) => {
          const nextScrolledPast = Object.fromEntries(
            Object.keys(currentValue).map((stringThreshold: string) => [
              stringThreshold,
              window.scrollY > Number(stringThreshold),
            ]),
          );

          return (threshold !== null &&
            !Object.hasOwn(nextScrolledPast, threshold)) ||
            Object.keys(nextScrolledPast).some(
              (key) => nextScrolledPast[key] !== currentValue[key],
            )
            ? nextScrolledPast
            : currentValue;
        });

        setNavbarHiddenByIdle(false);
      });

      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        setNavbarHiddenByIdle(true);
      }, IDLE_NAVBAR_TIMEOUT_MS);
    };

    onScroll();

    window.addEventListener("scroll", onScroll);

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
      window.removeEventListener("scroll", onScroll);
    };
  }, [threshold]);

  const trigger = useScrollTrigger();

  const isNavbarHidden =
    !mobileNavVisible &&
    !alwaysVisible &&
    scrolledPast[0] &&
    (trigger ||
      (threshold !== null && !scrolledPast[threshold]) ||
      navbarHiddenByIdle);

  return { scrolledPast, isNavbarHidden };
};

// @todo remove asPath from Navbar
export const Navbar: VFC<NavbarProps> = ({ openLoginModal }) => {
  const theme = useTheme();
  const { asPath, pathname } = useRouter();
  const { pages } = useContext(SiteMapContext);
  const { user } = useUser();

  const isHomePage = asPath === "/";
  const isDocs = asPath.startsWith("/docs");

  const md = useMediaQuery(theme.breakpoints.up("md"));

  const [mobileNavVisible, setMobileNavVisible] = useMobileNavVisible(!md);

  const { scrolledPast, isNavbarHidden } = useScrollingNavbar(
    isDocs,
    isHomePage ? HOME_PAGE_HEADER_HEIGHT : null,
    mobileNavVisible,
  );

  const navbarHeight = md ? DESKTOP_NAVBAR_HEIGHT : MOBILE_NAVBAR_HEIGHT;

  const crumbs = useCrumbs(pages);
  const displayBreadcrumbs = !md && !mobileNavVisible && crumbs.length > 0;
  const neighbourOffset =
    navbarHeight + (displayBreadcrumbs ? BREAD_CRUMBS_HEIGHT : 0);

  return (
    <Box
      sx={[
        {
          width: "100%",
          position: "absolute",
          zIndex: ({ zIndex }) => zIndex.appBar,
        },
        !isHomePage && { "+ *": { paddingTop: `${neighbourOffset}px` } },
      ]}
    >
      <Box
        sx={[
          {
            width: "100%",
            position: "fixed",
            top: isNavbarHidden ? navbarHeight * -1 : 0,
            zIndex: theme.zIndex.appBar,
            py: md ? 2 : 1,
            backgroundColor: theme.palette.common.white,
            transition: theme.transitions.create([
              ...(!isHomePage ||
              mobileNavVisible ||
              scrolledPast[HOME_PAGE_HEADER_HEIGHT * 0.75]
                ? ["top"]
                : []),
              "padding-top",
              "padding-bottom",
              "box-shadow",
              "border-bottom-color",
              "background-color",
            ]),
            borderBottomStyle: "solid",
            borderBottomWidth: 1,
            borderBottomColor: "transparent",
            /** @todo: find way to make drop-shadow appear behind mobile navigation links */
            ...(isDocs ||
            scrolledPast[isHomePage ? HOME_PAGE_HEADER_HEIGHT : 0] ||
            mobileNavVisible
              ? {
                  borderBottomColor: theme.palette.gray[30],
                  boxShadow:
                    !mobileNavVisible && !isNavbarHidden && !isDocs
                      ? theme.shadows[1]
                      : "none",
                }
              : {}),

            [`& .${navbarClasses.interactiveLink}`]: {
              marginRight: 3,
              transition: theme.transitions.create("color", {
                duration: 100,
              }),
              color: theme.palette.gray[70],
              "&:hover": {
                color: theme.palette.purple[600],
              },
              "&:active": {
                color: theme.palette.purple[700],
              },
            },
          },
          ...(isHomePage && !mobileNavVisible
            ? [
                !scrolledPast[HOME_PAGE_HEADER_HEIGHT * 0.5] && {
                  position: "absolute",
                  top: 0,
                },
              ]
            : []),
        ]}
      >
        <Container
          sx={[
            isDocs && { width: "100% !important", maxWidth: "100% !important" },
          ]}
        >
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
          >
            <Link
              href="/"
              sx={{
                color: ({ palette }) => palette.gray[90],
              }}
              className={navbarClasses.link}
            >
              <BlockProtocolLogoIcon
                onClick={() => setMobileNavVisible(false)}
                sx={{ color: "inherit" }}
              />
            </Link>
            <Box display="flex" alignItems="center">
              {md ? (
                <>
                  {pages.map(({ title, href }) => (
                    <Link
                      href={href}
                      key={href}
                      className={clsx(
                        navbarClasses.link,
                        navbarClasses.interactiveLink,
                      )}
                      sx={[
                        {
                          display: "flex",
                          alignItems: "center",
                        },
                        asPath.startsWith(href) && {
                          color: theme.palette.purple[600],
                        },
                      ]}
                    >
                      {NAVBAR_LINK_ICONS[title]}
                      <Typography
                        sx={{
                          marginLeft: 1,
                          fontWeight: 500,
                          fontSize: "var(--step--1)",
                          color: "currentColor",
                        }}
                      >
                        {title}
                      </Typography>
                    </Link>
                  ))}
                  {user || pathname === "/login" ? null : (
                    <Link
                      href="#"
                      onClick={openLoginModal}
                      className={clsx(
                        navbarClasses.link,
                        navbarClasses.interactiveLink,
                      )}
                      sx={{ backgroundColor: "unset" }}
                    >
                      <Typography
                        sx={{
                          fontWeight: 500,
                          fontSize: "var(--step--1)",
                          color: "currentColor",
                        }}
                      >
                        Log In
                      </Typography>
                    </Link>
                  )}
                  {user !== "loading" && !user?.isSignedUp ? (
                    <LinkButton href="/signup" size="small" variant="primary">
                      Sign Up
                    </LinkButton>
                  ) : null}
                </>
              ) : (
                <IconButton
                  onClick={() => setMobileNavVisible(!mobileNavVisible)}
                >
                  <FontAwesomeIcon
                    sx={{
                      fontSize: 20,
                    }}
                    icon={faBars}
                  />
                </IconButton>
              )}
              <AccountDropdown />
            </Box>
          </Box>
          <Collapse in={displayBreadcrumbs}>
            <MobileBreadcrumbs crumbs={crumbs} />
          </Collapse>
        </Container>
      </Box>
      <Slide
        in={mobileNavVisible}
        direction="right"
        timeout={400}
        easing={{
          enter: "ease-in-out",
          exit: "ease-in-out",
        }}
      >
        <Box
          sx={{
            zIndex: 1,
            marginTop: `${MOBILE_NAVBAR_HEIGHT}px`,
            position: "fixed",
            background: theme.palette.common.white,
            top: 0,
            left: 0,
            width: "100%",
            height: `calc(100% - ${MOBILE_NAVBAR_HEIGHT}px)`,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <Box
            sx={{
              overflow: "auto",
            }}
          >
            <MobileNavItems onClose={() => setMobileNavVisible(false)} />
          </Box>

          <Box
            p={5}
            flexShrink={0}
            display="flex"
            flexDirection="column"
            alignItems="center"
            sx={{
              borderTopStyle: "solid",
              borderTopWidth: 1,
              borderTopColor: theme.palette.gray[40],
              "> button, a": {
                width: {
                  xs: "100%",
                  sm: "unset",
                },
                minWidth: {
                  xs: "unset",
                  sm: 320,
                },
              },
            }}
          >
            {user ? null : pathname === "/login" ? null : (
              <LinkButton
                href="#"
                variant="secondary"
                onClick={(event) => {
                  setMobileNavVisible(false);
                  openLoginModal();
                  event?.preventDefault();
                }}
                sx={{
                  marginBottom: 1,
                }}
              >
                Log in
              </LinkButton>
            )}
            <LinkButton
              href="/signup"
              sx={{
                width: "100%",
                py: 1.5,
                px: 3,
                textTransform: "none",
              }}
              variant="primary"
              onClick={() => setMobileNavVisible(false)}
            >
              Sign Up
            </LinkButton>
          </Box>
        </Box>
      </Slide>
    </Box>
  );
};