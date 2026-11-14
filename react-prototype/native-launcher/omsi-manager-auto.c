#define _POSIX_C_SOURCE 200809L
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <sys/stat.h>
#include <unistd.h>

// Native, nonprivileged Linux launcher. It never reads or changes game files.
enum desktop { UNKNOWN, GNOME, KDE, HYPRLAND };
static enum desktop desktop_from(const char *value) {
  if (!value || strlen(value)>256) return UNKNOWN;
  char copy[257]; strcpy(copy,value);
  enum desktop found=UNKNOWN;
  char *save=NULL;
  for(char *t=strtok_r(copy,":",&save);t;t=strtok_r(NULL,":",&save)) {
    enum desktop now=UNKNOWN;
    if(!strcasecmp(t,"GNOME")||!strcasecmp(t,"GNOME-Classic")) now=GNOME;
    if(!strcasecmp(t,"KDE")||!strcasecmp(t,"Plasma")) now=KDE;
    if(!strcasecmp(t,"Hyprland")) now=HYPRLAND;
    if(now!=UNKNOWN) {
      if(found!=UNKNOWN && found!=now) return UNKNOWN;
      found=now;
    }
  }
  return found;
}
static const char *desktop_label(enum desktop d) {
  if(d==GNOME) return "gnome";
  if(d==KDE) return "kde";
  if(d==HYPRLAND) return "hyprland";
  return "unknown";
}
static const char *backend_from(enum desktop d) {
  const char *session=getenv("XDG_SESSION_TYPE");
  const char *wayland=getenv("WAYLAND_DISPLAY");
  const char *runtime=getenv("XDG_RUNTIME_DIR");
  const char *display=getenv("DISPLAY");
  if(session && !strcmp(session,"wayland") &&
    ((wayland&&wayland[0])||(runtime&&runtime[0]=='/'))) return "wayland";
  if(session && !strcmp(session,"x11") && display&&display[0] && d!=HYPRLAND)
    return "x11";
  return "auto"; // Safe fallback to Electron 38 native display detection.
}
// Explicit, user-invoked, read-only preflight. These three kernel switches
// are fixed paths; no arbitrary input, subprocess, privileged operation or
// raw kernel text is included in the report. This cannot certify sandboxing.
static const char *fixed_proc_category(const char *filename,int capacity) {
  FILE *fp=fopen(filename,"r");
  if(!fp) return "unavailable";
  unsigned char data[48];
  size_t n=fread(data,1,sizeof(data),fp);
  fclose(fp);
  if(n==0 || n>=sizeof(data)) return "unknown";
  while(n && (data[n-1]=='\n' || data[n-1]=='\r')) n--;
  if(!capacity) {
    if(n==1 && data[0]=='0') return "disabled";
    if(n==1 && data[0]=='1') return "enabled";
    return "unknown";
  }
  if(n==0 || n>18) return "unknown";
  int positive=0;
  for(size_t i=0;i<n;i++) {
    if(data[i]<'0' || data[i]>'9') return "unknown";
    if(data[i]!='0') positive=1;
  }
  return positive ? "positive" : "zero";
}
// Non-fatal, privacy-safe hint before the actual Electron exec. A switch
// indicates risk, not proof of a sandbox failure or AppArmor causality.
// Never change permissions, attempt namespaces, or disable Electron sandbox.
static void warn_sandbox_host_policy(void) {
  const char *apparmor=fixed_proc_category(
    "/proc/sys/kernel/apparmor_restrict_unprivileged_userns",0);
  const char *userns=fixed_proc_category(
    "/proc/sys/kernel/unprivileged_userns_clone",0);
  const char *capacity=fixed_proc_category(
    "/proc/sys/user/max_user_namespaces",1);
  if(!strcmp(apparmor,"enabled") || !strcmp(userns,"disabled") ||
     !strcmp(capacity,"zero"))
    fputs("OMSI Manager Auto: host sandbox policy may restrict Electron startup; "
          "review read-only diagnostics with your administrator. "
          "No security setting was changed.\n",stderr);
}

static int diagnose_sandbox(void) {
  const char *apparmor=fixed_proc_category(
    "/proc/sys/kernel/apparmor_restrict_unprivileged_userns",0);
  const char *unprivileged=fixed_proc_category(
    "/proc/sys/kernel/unprivileged_userns_clone",0);
  const char *capacity=fixed_proc_category(
    "/proc/sys/user/max_user_namespaces",1);
  const int restricted=!strcmp(apparmor,"enabled") ||
    !strcmp(unprivileged,"disabled") || !strcmp(capacity,"zero");
  const int clear=!strcmp(apparmor,"disabled") &&
    !strcmp(unprivileged,"enabled") && !strcmp(capacity,"positive");
  puts("OMSI_MANAGER_SANDBOX_PREFLIGHT_V1");
  printf("apparmorUsernsRestriction=%s\n",apparmor);
  printf("unprivilegedUsernsSwitch=%s\n",unprivileged);
  printf("usernsCapacity=%s\n",capacity);
  printf("userNamespacePolicyHint=%s\n",
    restricted?"restriction-indicated":clear?"no-obvious-restriction":"undetermined");
  puts("userNamespaceCreationVerified=false");
  puts("electronSandboxVerified=false");
  puts("hostSecurityPolicyChanged=false");
  puts("securityBypassApplied=false");
  puts("nextAction=review-read-only-diagnostic-with-system-administrator");
  return 0;
}

static int refuse(const char *reason) {
  fprintf(stderr,"OMSI Manager Auto: %s\n",reason);
  return 3;
}
int main(int argc,char **argv) {
  const int diagnostic=(argc==2 && !strcmp(argv[1],"--diagnose-sandbox"));
  if(argc!=1 && !diagnostic) return refuse("option not permitted");
  if(getuid()==0 || geteuid()==0) return refuse("do not launch as root");
  if(diagnostic) return diagnose_sandbox();
  enum desktop d=desktop_from(getenv("XDG_CURRENT_DESKTOP"));
  const char *backend=backend_from(d);
  char self[PATH_MAX];
  ssize_t n=readlink("/proc/self/exe",self,sizeof(self)-1);
  if(n<=0 || (size_t)n>=sizeof(self)-1) return refuse("launcher path unavailable");
  self[n]='\0';
  char *slash=strrchr(self,'/');
  if(!slash) return refuse("launcher folder unavailable");
  *slash='\0';
  char target[PATH_MAX];
  int length=snprintf(target,sizeof(target),"%s/OMSI-Manager-Preview",self);
  if(length<=0 || (size_t)length>=sizeof(target)) return refuse("executable path too long");
  struct stat st;
  if(lstat(target,&st)!=0 || !S_ISREG(st.st_mode) || !(st.st_mode&0111))
    return refuse("portable program is missing or redirected");
  if(setenv("OMSI_MANAGER_DESKTOP_PROFILE",desktop_label(d),1)!=0 ||
     setenv("OMSI_MANAGER_DISPLAY_PROFILE",backend,1)!=0)
    return refuse("desktop configuration unavailable");
  char mode[64];
  length=snprintf(mode,sizeof(mode),"--ozone-platform=%s",backend);
  if(length<=0 || (size_t)length>=sizeof(mode)) return refuse("display mode invalid");
  char *const app_argv[]={target,mode,NULL};
  // Advice is informational; proceed with exactly the same strict sandbox.
  warn_sandbox_host_policy();
  execv(target,app_argv);
  return refuse("could not start application");
}
