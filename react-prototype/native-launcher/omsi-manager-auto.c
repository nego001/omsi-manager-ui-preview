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
static int refuse(const char *reason) {
  fprintf(stderr,"OMSI Manager Auto: %s\n",reason);
  return 3;
}
int main(int argc,char **argv) {
  (void)argv;
  if(argc!=1) return refuse("no command-line options accepted");
  if(getuid()==0 || geteuid()==0) return refuse("do not launch as root");
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
  execv(target,app_argv);
  return refuse("could not start application");
}
