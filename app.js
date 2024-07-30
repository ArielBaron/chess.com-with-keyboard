const puppeteer = require('puppeteer');
require('dotenv').config();

const { EMAIL, PASSWORD } = process.env;
const EmailInputSelector = "#username-input-field > div > input";
const PasswordInputSelector = "#password-input-field > div > input";
const NextBtnSelector = "#login";
const ExitSuggestionBtnSelector = "#coach-nudges-modal > div > div.cc-modal-body > div > span";
const NewGameBtnSelector = "body > div.base-layout > div.base-container > div.promo-component > div:nth-child(1) > div > a:nth-child(2)";
const TimeControlBtnSelector = "#board-layout-sidebar > div > div.tab-container-component.tab-content-component > div > div.new-game-index-content > div.create-game-component > div:nth-child(1) > button";
const PlayBtnSelector = "#board-layout-sidebar > div > div.tab-container-component.tab-content-component > div > div.new-game-index-content > div.create-game-component > button";
const TimeBtnSelectors = {
  '1m': "#board-layout-sidebar > div > div.tab-container-component.tab-content-component > div > div.new-game-index-content > div.create-game-component > div:nth-child(1) > div > div:nth-child(1) > div.time-selector-field-component > button:nth-child(1)",
  '1m+1': "#board-layout-sidebar > div > div.tab-container-component.tab-content-component > div > div.new-game-index-content > div.create-game-component > div:nth-child(1) > div > div:nth-child(1) > div.time-selector-field-component > button:nth-child(2)",
  "2m+1": "#board-layout-sidebar > div > div.tab-container-component.tab-content-component > div > div.new-game-index-content > div.create-game-component > div:nth-child(1) > div > div:nth-child(1) > div.time-selector-field-component > button:nth-child(3)",
  "3m": "#board-layout-sidebar > div > div.tab-container-component.tab-content-component > div > div.new-game-index-content > div.create-game-component > div:nth-child(1) > div > div:nth-child(2) > div.time-selector-field-component > button:nth-child(1)",
  "3m+2": "#board-layout-sidebar > div > div.tab-container-component.tab-content-component > div > div.new-game-index-content > div.create-game-component > div:nth-child(1) > div > div:nth-child(2) > div.time-selector-field-component > button:nth-child(2)",
  "5m": "#board-layout-sidebar > div > div.tab-container-component.tab-content-component > div > div.new-game-index-content > div.create-game-component > div:nth-child(1) > div > div:nth-child(2) > div.time-selector-field-component > button:nth-child(3)",
  "10m": "#board-layout-sidebar > div > div.tab-container-component.tab-content-component > div > div.new-game-index-content > div.create-game-component > div:nth-child(1) > div > div:nth-child(3) > div.time-selector-field-component > button:nth-child(1)",
  "15m+10": "#board-layout-sidebar > div > div.tab-container-component.tab-content-component > div > div.new-game-index-content > div.create-game-component > div:nth-child(1) > div > div:nth-child(3) > div.time-selector-field-component > button:nth-child(2)",
  "30m": "#board-layout-sidebar > div > div.tab-container-component.tab-content-component > div > div.new-game-index-content > div.create-game-component > div:nth-child(1) > div > div:nth-child(3) > div.time-selector-field-component > button:nth-child(3)",
};

const getCurrentHtmlBoardAndTurn = async (page) => {
  await page.waitForSelector("#board-single");
  await page.waitForSelector("#board-single > svg.coordinates > text:nth-child(8)");

  const result = await page.evaluate(() => {
    const htmlBoard = document.getElementById("board-single").innerHTML;
    
    const blackClock = document.querySelector('.clock-bottom.clock-black');
    const whiteClock = document.querySelector('.clock-top.clock-white');
    
    let turn;
    if (blackClock.classList.contains('clock-player-turn')) {
      turn = 'Black';
    } else if (whiteClock.classList.contains('clock-player-turn')) {
      turn = 'White';
    } else {
      turn = 'Unknown';
    }
    
    return { htmlBoard, turn };
  });

  return result;
};

const htmlBoardToColumnBListBoard = (htmlBoard) => {
  const pieceMap = {
    'wk': 'K', 'wq': 'Q', 'wr': 'R', 'wb': 'B', 'wn': 'N', 'wp': 'P',
    'bk': 'k', 'bq': 'q', 'br': 'r', 'bb': 'b', 'bn': 'n', 'bp': 'p'
  };

  const board = Array(8).fill(null).map(() => Array(8).fill('.'));
  
  const divPattern = /<div class="piece (\w{2}) square-(\d{2})" style=""><\/div>/g;
  let match;

  while ((match = divPattern.exec(htmlBoard)) !== null) {
    const piece = match[1];
    const square = parseInt(match[2], 10);
    const row = 8 - Math.floor(square / 10);
    const col = (square % 10) - 1;
    board[row][col] = pieceMap[piece];
  }
  return board;
};

const columnBListBoardToRowBoard = (columnBListBoard) => {
  columnBListBoard  = columnBListBoard.flat();
  const rowBoard = Array.from({ length: 8 }, () => []);
  for (let i = 0; i < columnBListBoard.length; i++) {
    const col = i % 8;
    rowBoard[col].push(columnBListBoard[i]);
  }
  return rowBoard.flat();
};

function chessBoardToFEN(boardArray) {
  let fen = '';
  for (let i = 0; i < 8; i++) {
    let row = boardArray.slice(i * 8, (i + 1) * 8);
    let emptyCount = 0;
    let fenRow = '';

    row.forEach(piece => {
      if (piece === '.') {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          fenRow += emptyCount;
          emptyCount = 0;
        }
        fenRow += piece;
      }
    });

    if (emptyCount > 0) {
      fenRow += emptyCount;
    }

    fen += fenRow;
    if (i < 7) {
      fen += '/';
    }
  }
  return fen;
}

const awaitAndClick = async (page, selector) => {
  try {
    await page.waitForSelector(selector);
    await page.click(selector);
  } catch (error) {
    console.error(`Error waiting for and clicking selector ${selector}:`, error);
  }
};

const awaitAndType = async (page, selector, text) => {
  try {
    await page.waitForSelector(selector);
    await page.type(selector, text);
  } catch (error) {
    console.error(`Error waiting for and typing in selector ${selector}:`, error);
  }
};

const clickIfExists = async (page, selector) => {
  const element = await page.$(selector);
  if (element) {
    await page.click(selector);
  }
};

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--window-size=1100,900'],
    executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 900 });
  await page.goto('https://www.chess.com/login_and_go?returnUrl=https://www.chess.com/');

  await awaitAndType(page, EmailInputSelector, EMAIL);
  await awaitAndType(page, PasswordInputSelector, PASSWORD);
  await awaitAndClick(page, NextBtnSelector);
  await clickIfExists(page, ExitSuggestionBtnSelector);

  await awaitAndClick(page, NewGameBtnSelector);

  const TimeControl = await page.evaluate(() => {
    return prompt('Please enter Time Control (1m, 1m+1, 2m+1, | 3m, 3m+2, 5m | 10m, 15m+10, 30m):');
  });

  await awaitAndClick(page, TimeControlBtnSelector);
  await awaitAndClick(page, TimeBtnSelectors[TimeControl]);
  await awaitAndClick(page, PlayBtnSelector);

  const { htmlBoard, turn } = await getCurrentHtmlBoardAndTurn(page);
  const listBoard = htmlBoardToColumnBListBoard(htmlBoard);
  const ChessBoard = columnBListBoardToRowBoard(listBoard);
  const FEN = chessBoardToFEN(ChessBoard);
  
  console.log("FEN:", FEN);
  console.log("Turn:", turn);

  await page.waitForNavigation({ waitUntil: 'domcontentloaded' });

  const move = await page.evaluate(() => {
    return prompt('Enter your move in standard chess notation: ');
  });

  console.log("Move:", move);

  await browser.close();
})();
