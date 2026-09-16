const {
  app,
  BrowserWindow,
  ipcMain,
  Notification
} = require('electron');

const path = require('path');
const util = require('util');
const Datastore = require('nedb');

// ============================================================
// NeDB COMPATIBILITY FOR MODERN NODE.JS
// ============================================================

if (typeof util.isDate !== 'function') {
  util.isDate = function (value) {
    return Object.prototype.toString.call(value) === '[object Date]';
  };
}

if (typeof util.isArray !== 'function') {
  util.isArray = Array.isArray;
}

if (typeof util.isRegExp !== 'function') {
  util.isRegExp = function (value) {
    return Object.prototype.toString.call(value) === '[object RegExp]';
  };
}

// ============================================================
// GLOBAL VARIABLES
// ============================================================

let db = null;

let mainWindow = null;
let overlayWindow = null;

let currentApp = null;
let currentCategory = null;
let startTime = null;

let deepWorkMode = false;
let trackingInterval = null;

let activeWindowFunction = null;

// ============================================================
// CATEGORY KEYWORDS
// ============================================================

const LEARNING_KEYWORDS = [
  'code',
  'coding',
  'vscode',
  'visual studio code',
  'python',
  'tutorial',
  'docs',
  'stackoverflow',
  'github',
  'udemy',
  'coursera',
  'documentation',
  'java',
  'javascript',
  'html',
  'css',
  'react',
  'node',
  'node.js',
  'programming',
  'leetcode',
  'hackerrank',
  'freecodecamp',
  'developer',
  'development',
  'w3schools',
  'npm',
  'git',
  'terminal',
  'cmd',
  'powershell'
];

const DISTRACTION_KEYWORDS = [
  'netflix',
  'youtube',
  'facebook',
  'instagram',
  'reddit',
  'tiktok',
  'gaming',
  'game',
  'twitch',
  'spotify',
  'twitter',
  'x.com',
  'reels',
  'comedy',
  'trailer',
  'movie',
  'series',
  'meme',
  'snapchat',
  'prime video',
  'hotstar',
  'disney',
  'crunchyroll'
];

// ============================================================
// CATEGORY DETECTION
// ============================================================

function categorize(text) {
  const value = String(text || '').toLowerCase();

  if (
    LEARNING_KEYWORDS.some((keyword) =>
      value.includes(keyword)
    )
  ) {
    return 'learning';
  }

  if (
    DISTRACTION_KEYWORDS.some((keyword) =>
      value.includes(keyword)
    )
  ) {
    return 'distraction';
  }

  return 'productive';
}

// ============================================================
// LOCAL DATE
// ============================================================

function getToday() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// ============================================================
// DATABASE INITIALIZATION
// ============================================================

function initializeDatabase() {
  const databasePath = path.join(
    app.getPath('userData'),
    'career-tracker.db'
  );

  console.log('Database location:', databasePath);

  db = new Datastore({
    filename: databasePath,
    autoload: true
  });

  console.log('Database initialized successfully');
}

// ============================================================
// LOAD GET-WINDOWS
// ============================================================

async function loadActiveWindow() {
  try {
    const windowsModule = await import('get-windows');

    console.log(
      'get-windows exports:',
      Object.keys(windowsModule)
    );

    activeWindowFunction =
      windowsModule.activeWindow;

    if (
      typeof activeWindowFunction !== 'function'
    ) {
      console.error(
        'get-windows activeWindow() was not found.'
      );

      activeWindowFunction = null;

      return false;
    }

    console.log(
      'get-windows loaded successfully.'
    );

    return true;
  } catch (error) {
    console.error(
      'Failed to load get-windows:',
      error.message
    );

    activeWindowFunction = null;

    return false;
  }
}

// ============================================================
// MAIN WINDOW
// ============================================================

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,

    minWidth: 800,
    minHeight: 600,

    backgroundColor: '#0d0d14',

    show: false,

    webPreferences: {
      preload: path.join(
        __dirname,
        'preload.js'
      ),

      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(
    path.join(__dirname, 'index.html')
  );

  mainWindow.once(
    'ready-to-show',
    () => {
      if (
        mainWindow &&
        !mainWindow.isDestroyed()
      ) {
        mainWindow.show();
      }
    }
  );

  mainWindow.on(
    'closed',
    () => {
      mainWindow = null;
    }
  );
}

// ============================================================
// OVERLAY WINDOW
// ============================================================

function createOverlayWindow(title) {
  if (overlayWindow) {
    try {
      overlayWindow.close();
    } catch (_) {}

    overlayWindow = null;
  }

  overlayWindow = new BrowserWindow({
    width: 600,
    height: 400,

    frame: false,
    alwaysOnTop: true,
    resizable: false,
    transparent: true,

    webPreferences: {
      preload: path.join(
        __dirname,
        'preload.js'
      ),

      contextIsolation: true,
      nodeIntegration: false
    }
  });

  overlayWindow.loadFile(
    path.join(__dirname, 'overlay.html')
  );

  overlayWindow.once(
    'ready-to-show',
    () => {
      if (
        !overlayWindow ||
        overlayWindow.isDestroyed()
      ) {
        return;
      }

      overlayWindow.show();

      overlayWindow.webContents.send(
        'overlay-init',
        {
          appTitle: title
        }
      );
    }
  );

  overlayWindow.on(
    'closed',
    () => {
      overlayWindow = null;
    }
  );
}

// ============================================================
// SAVE SESSION
// ============================================================

function saveSession(
  appName,
  category,
  duration
) {
  if (!db) {
    console.warn(
      'Database is not initialized.'
    );

    return;
  }

  if (!appName) {
    return;
  }

  const seconds = Number(duration);

  if (!Number.isFinite(seconds)) {
    return;
  }

  // Ignore sessions shorter than 2 seconds.
  if (seconds < 2) {
    return;
  }

  const record = {
    app_name: appName,
    category: category || categorize(appName),
    duration: Math.floor(seconds),
    date: getToday(),
    timestamp: Date.now()
  };

  db.insert(
    record,
    (error) => {
      if (error) {
        console.error(
          'Failed to save session:',
          error.message
        );

        return;
      }

      console.log(
        `Session saved: ${record.app_name} - ` +
        `${record.duration}s - ${record.category}`
      );

      if (
        mainWindow &&
        !mainWindow.isDestroyed()
      ) {
        mainWindow.webContents.send(
          'session-saved',
          {
            app: record.app_name,
            duration: record.duration,
            category: record.category
          }
        );
      }
    }
  );
}

// ============================================================
// SEND LIVE ACTIVITY TO RENDERER
// ============================================================

function sendLiveActivity(
  title,
  category,
  duration
) {
  if (
    !mainWindow ||
    mainWindow.isDestroyed()
  ) {
    return;
  }

  mainWindow.webContents.send(
    'active-window',
    {
      title,
      app: title,
      category,
      duration
    }
  );
}

// ============================================================
// RESET CURRENT SESSION
// ============================================================

function resetCurrentSession() {
  currentApp = null;
  currentCategory = null;
  startTime = null;
}

// ============================================================
// SAVE CURRENT SESSION
// ============================================================

function saveCurrentSession() {
  if (
    !currentApp ||
    !startTime
  ) {
    return;
  }

  const duration = Math.floor(
    (Date.now() - startTime) / 1000
  );

  console.log(
    `Saving current session: ${currentApp} | ${duration}s`
  );

  saveSession(
    currentApp,
    currentCategory ||
      categorize(currentApp),
    duration
  );

  resetCurrentSession();
}

// ============================================================
// CHECK IF THIS IS OUR OWN APPLICATION
// ============================================================

function isOwnApplication(
  title,
  ownerName
) {
  const titleText =
    String(title || '').toLowerCase();

  const ownerText =
    String(ownerName || '').toLowerCase();

  return (
    titleText.includes(
      'ai career tracker'
    ) ||
    titleText.includes(
      'career-tracker'
    ) ||
    titleText.includes(
      'ai-digital well-being'
    ) ||
    titleText.includes(
      'ai digital well-being'
    ) ||
    ownerText === 'electron' ||
    ownerText.includes(
      'electron'
    )
  );
}

// ============================================================
// START ACTIVITY TRACKING
// ============================================================

async function startTracking() {
  const loaded =
    await loadActiveWindow();

  if (
    !loaded ||
    !activeWindowFunction
  ) {
    console.warn(
      'get-windows is not available.'
    );

    console.warn(
      'Activity tracking disabled.'
    );

    return;
  }

  if (trackingInterval) {
    clearInterval(
      trackingInterval
    );

    trackingInterval = null;
  }

  console.log(
    'Activity tracking started.'
  );

  // Check every 2 seconds.
  trackingInterval =
    setInterval(
      async () => {
        try {
          const win =
            await activeWindowFunction();

          if (!win) {
            console.warn(
              'No active window detected.'
            );

            return;
          }

          // --------------------------------------------------
          // GET WINDOW INFORMATION
          // --------------------------------------------------

          const title =
            String(
              win.title ||
              ''
            ).trim();

          const ownerName =
            String(
              win.owner?.name ||
              ''
            ).trim();

          const ownerPath =
            String(
              win.owner?.path ||
              ''
            ).trim();

          if (
            !title &&
            !ownerName
          ) {
            return;
          }

          // Use title + application name
          // for better classification.
          const detectionText =
            `${title} ${ownerName}`;

          const category =
            categorize(
              detectionText
            );

          console.log(
            'Active window:',
            title || 'Unknown',
            '| App:',
            ownerName || 'Unknown',
            '| Category:',
            category
          );

          // --------------------------------------------------
          // IGNORE OUR OWN ELECTRON APP
          // --------------------------------------------------

          if (
            isOwnApplication(
              title,
              ownerName
            )
          ) {
            if (overlayWindow) {
              try {
                overlayWindow.close();
              } catch (_) {}

              overlayWindow = null;
            }

            return;
          }

          // --------------------------------------------------
          // DEEP WORK BLOCKING
          // --------------------------------------------------

          if (
            deepWorkMode &&
            category ===
              'distraction'
          ) {
            if (!overlayWindow) {
              createOverlayWindow(
                title ||
                ownerName
              );
            }

            if (
              mainWindow &&
              !mainWindow.isDestroyed()
            ) {
              mainWindow.webContents.send(
                'blocked',
                title ||
                  ownerName
              );
            }

            try {
              new Notification({
                title:
                  'Focus Locked',

                body:
                  `"${title || ownerName}" ` +
                  'is blocked. ' +
                  'Deep Work is ON.'
              }).show();
            } catch (_) {
              // Ignore notification errors.
            }

            // We do not count the blocked
            // distraction as a normal session.
            if (currentApp) {
              saveCurrentSession();
            }

            return;
          }

          // --------------------------------------------------
          // CLOSE OVERLAY
          // --------------------------------------------------

          if (
            overlayWindow &&
            category !==
              'distraction'
          ) {
            try {
              overlayWindow.close();
            } catch (_) {}

            overlayWindow = null;
          }

          // --------------------------------------------------
          // DETERMINE APPLICATION NAME
          // --------------------------------------------------

          const applicationTitle =
            title ||
            ownerName ||
            ownerPath ||
            'Unknown';

          // --------------------------------------------------
          // APPLICATION CHANGED
          // --------------------------------------------------

          if (
            currentApp &&
            currentApp !==
              applicationTitle
          ) {
            const duration =
              Math.floor(
                (Date.now() -
                  startTime) /
                  1000
              );

            console.log(
              `Application changed: ` +
              `${currentApp} -> ` +
              `${applicationTitle}`
            );

            console.log(
              `Previous duration: ${duration}s`
            );

            saveSession(
              currentApp,
              currentCategory ||
                categorize(
                  currentApp
                ),
              duration
            );

            resetCurrentSession();
          }

          // --------------------------------------------------
          // START NEW APPLICATION
          // --------------------------------------------------

          if (
            currentApp !==
            applicationTitle
          ) {
            currentApp =
              applicationTitle;

            currentCategory =
              category;

            startTime =
              Date.now();

            console.log(
              `Started tracking: ` +
              `${currentApp} | ` +
              `${currentCategory}`
            );
          }

          // --------------------------------------------------
          // LIVE DURATION
          // --------------------------------------------------

          const liveDuration =
            startTime
              ? Math.floor(
                  (Date.now() -
                    startTime) /
                    1000
                )
              : 0;

          // --------------------------------------------------
          // SEND LIVE INFORMATION TO UI
          // --------------------------------------------------

          sendLiveActivity(
            currentApp,
            currentCategory,
            liveDuration
          );

        } catch (error) {
          console.error(
            'Activity tracking error:',
            error.message
          );
        }
      },
      2000
    );
}

// ============================================================
// IPC: GET TODAY'S STATS
// ============================================================

ipcMain.handle(
  'get-stats',
  () => {
    return new Promise(
      (resolve) => {
        if (!db) {
          resolve([]);
          return;
        }

        const today =
          getToday();

        db.find(
          {
            date: today
          },
          (
            error,
            docs
          ) => {
            if (error) {
              console.error(
                'Failed to get stats:',
                error.message
              );

              resolve([]);
              return;
            }

            const grouped = {};

            docs.forEach(
              (doc) => {
                const category =
                  doc.category ||
                  'productive';

                grouped[category] =
                  (grouped[category] ||
                    0) +
                  Number(
                    doc.duration ||
                      0
                  );
              }
            );

            // Add the currently running
            // application to today's stats.
            if (
              currentApp &&
              startTime
            ) {
              const liveDuration =
                Math.floor(
                  (Date.now() -
                    startTime) /
                    1000
                );

              if (
                liveDuration > 0
              ) {
                const liveCategory =
                  currentCategory ||
                  categorize(
                    currentApp
                  );

                grouped[
                  liveCategory
                ] =
                  (grouped[
                    liveCategory
                  ] || 0) +
                  liveDuration;
              }
            }

            const result =
              Object.entries(
                grouped
              ).map(
                ([
                  category,
                  total
                ]) => ({
                  category,
                  total
                })
              );

            resolve(result);
          }
        );
      }
    );
  }
);

// ============================================================
// IPC: GET 7-DAY TREND
// ============================================================

ipcMain.handle(
  'get-7day',
  () => {
    return new Promise(
      (resolve) => {
        if (!db) {
          resolve([]);
          return;
        }

        const sevenDaysAgo =
          new Date();

        sevenDaysAgo.setDate(
          sevenDaysAgo.getDate() -
            7
        );

        const cutoff =
          [
            sevenDaysAgo.getFullYear(),

            String(
              sevenDaysAgo.getMonth() +
                1
            ).padStart(2, '0'),

            String(
              sevenDaysAgo.getDate()
            ).padStart(2, '0')
          ].join('-');

        db.find(
          {
            date: {
              $gte: cutoff
            }
          },
          (
            error,
            docs
          ) => {
            if (error) {
              console.error(
                'Failed to get 7-day data:',
                error.message
              );

              resolve([]);
              return;
            }

            const grouped = {};

            docs.forEach(
              (doc) => {
                const key =
                  `${doc.date}__${doc.category}`;

                grouped[key] =
                  (grouped[key] || 0) +
                  Number(
                    doc.duration ||
                      0
                  );
              }
            );

            const result =
              Object.entries(
                grouped
              ).map(
                ([
                  key,
                  total
                ]) => {
                  const parts =
                    key.split(
                      '__'
                    );

                  return {
                    date: parts[0],
                    category: parts[1],
                    total
                  };
                }
              );

            // Add current live session.
            if (
              currentApp &&
              startTime
            ) {
              const liveDuration =
                Math.floor(
                  (Date.now() -
                    startTime) /
                    1000
                );

              if (
                liveDuration > 0
              ) {
                result.push({
                  date: getToday(),
                  category:
                    currentCategory ||
                    categorize(
                      currentApp
                    ),
                  total:
                    liveDuration
                });
              }
            }

            result.sort(
              (a, b) =>
                a.date.localeCompare(
                  b.date
                )
            );

            resolve(result);
          }
        );
      }
    );
  }
);

// ============================================================
// IPC: GET HISTORY
// ============================================================

ipcMain.handle(
  'get-history',
  () => {
    return new Promise(
      (resolve) => {
        if (!db) {
          resolve([]);
          return;
        }

        db.find({})
          .sort({
            timestamp: -1
          })
          .limit(100)
          .exec(
            (
              error,
              docs
            ) => {
              if (error) {
                console.error(
                  'Failed to get history:',
                  error.message
                );

                resolve([]);
                return;
              }

              const grouped = {};

              docs.forEach(
                (doc) => {
                  const key =
                    `${doc.app_name}__${doc.date}`;

                  if (
                    !grouped[key]
                  ) {
                    grouped[key] = {
                      app_name:
                        doc.app_name,

                      category:
                        doc.category,

                      duration: 0,

                      date:
                        doc.date
                    };
                  }

                  grouped[key]
                    .duration +=
                    Number(
                      doc.duration ||
                        0
                    );
                }
              );

              // Add current live session.
              if (
                currentApp &&
                startTime
              ) {
                const liveDuration =
                  Math.floor(
                    (Date.now() -
                      startTime) /
                      1000
                  );

                if (
                  liveDuration > 0
                ) {
                  const today =
                    getToday();

                  const key =
                    `${currentApp}__${today}`;

                  if (
                    !grouped[key]
                  ) {
                    grouped[key] = {
                      app_name:
                        currentApp,

                      category:
                        currentCategory ||
                        categorize(
                          currentApp
                        ),

                      duration: 0,

                      date: today
                    };
                  }

                  grouped[key]
                    .duration +=
                    liveDuration;
                }
              }

              const result =
                Object.values(
                  grouped
                )
                  .sort(
                    (a, b) => {
                      if (
                        a.date !==
                        b.date
                      ) {
                        return b.date.localeCompare(
                          a.date
                        );
                      }

                      return (
                        b.duration -
                        a.duration
                      );
                    }
                  )
                  .slice(
                    0,
                    50
                  );

              resolve(result);
            }
          );
      }
    );
  }
);

// ============================================================
// IPC: TOGGLE DEEP WORK
// ============================================================

ipcMain.handle(
  'set-deep-work',
  (
    _event,
    value
  ) => {
    deepWorkMode =
      Boolean(value);

    if (
      !deepWorkMode &&
      overlayWindow
    ) {
      try {
        overlayWindow.close();
      } catch (_) {}

      overlayWindow = null;
    }

    console.log(
      `Deep Work Mode: ${
        deepWorkMode
          ? 'ON'
          : 'OFF'
      }`
    );

    return deepWorkMode;
  }
);

// ============================================================
// IPC: CLOSE OVERLAY
// ============================================================

ipcMain.handle(
  'close-overlay',
  () => {
    if (overlayWindow) {
      try {
        overlayWindow.close();
      } catch (_) {}

      overlayWindow = null;
    }

    return true;
  }
);

// ============================================================
// IPC: GET CAREER XP
// ============================================================

ipcMain.handle(
  'get-career-xp',
  () => {
    return new Promise(
      (resolve) => {
        if (!db) {
          resolve(0);
          return;
        }

        db.find(
          {
            category: {
              $in: [
                'learning',
                'productive'
              ]
            }
          },
          (
            error,
            docs
          ) => {
            if (error) {
              console.error(
                'Failed to get career XP:',
                error.message
              );

              resolve(0);
              return;
            }

            let total =
              docs.reduce(
                (
                  sum,
                  doc
                ) =>
                  sum +
                  Number(
                    doc.duration ||
                      0
                  ),
                0
              );

            // Include current live
            // learning/productive time.
            if (
              currentApp &&
              startTime
            ) {
              const liveCategory =
                currentCategory ||
                categorize(
                  currentApp
                );

              if (
                liveCategory ===
                  'learning' ||
                liveCategory ===
                  'productive'
              ) {
                total +=
                  Math.floor(
                    (Date.now() -
                      startTime) /
                      1000
                  );
              }
            }

            resolve(total);
          }
        );
      }
    );
  }
);

// ============================================================
// ELECTRON APP LIFECYCLE
// ============================================================

app.whenReady().then(
  async () => {
    console.log(
      'Electron is ready.'
    );

    // Initialize database only
    // after Electron is ready.
    initializeDatabase();

    // Create UI.
    createMainWindow();

    // Start activity tracking.
    await startTracking();

    app.on(
      'activate',
      () => {
        if (
          BrowserWindow
            .getAllWindows()
            .length === 0
        ) {
          createMainWindow();
        }
      }
    );
  }
);

// ============================================================
// APP CLOSE
// ============================================================

app.on(
  'before-quit',
  () => {
    console.log(
      'Application is quitting...'
    );

    // Save current session.
    if (
      currentApp &&
      startTime
    ) {
      saveCurrentSession();
    }

    if (trackingInterval) {
      clearInterval(
        trackingInterval
      );

      trackingInterval = null;
    }
  }
);

app.on(
  'window-all-closed',
  () => {
    if (
      process.platform !==
      'darwin'
    ) {
      app.quit();
    }
  }
);