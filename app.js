const puppeteer = require('puppeteer');
const Swal = require('sweetalert2');
const { Chess } = require('chess.js');
require('dotenv').config();


const {   EMAIL,  PASSWORD } = process.env;
const emailInputSelector = "#username-input-field > div > input";
const passwordInputSelector = "#password-input-field > div > input";
const nextBtnSelector = "#login";
const exitSuggestionBtnSelector = "#coach-nudges-modal > div > div.cc-modal-body > div > span";
const newGameBtnSelector = "body > div.base-layout > div.base-container > div.promo-component > div:nth-child(1) > div > a:nth-child(2)";
const timeControlBtnSelector = ".selector-button-button";
const playBtnSelector = "#board-layout-sidebar > div > div.tab-container-component.tab-content-component > div > div.new-game-index-content > div.create-game-component > button";
const timeBtnSelectors = {
  // Bullet
  '1m': '#board-layout-sidebar > div > div.tab-container-component.tab-content-component > div > div.new-game-index-content > div.create-game-component > div:nth-child(1) > div > div:nth-child(2) > div.time-selector-field-component > button:nth-child(1)',
  '1m+1': '#board-layout-sidebar > div > div.tab-container-component.tab-content-component > div > div.new-game-index-content > div.create-game-component > div:nth-child(1) > div > div:nth-child(2) > div.time-selector-field-component > button:nth-child(2)',
  '2m+1': '#board-layout-sidebar > div > div.tab-container-component.tab-content-component > div > div.new-game-index-content > div.create-game-component > div:nth-child(1) > div > div:nth-child(2) > div.time-selector-field-component > button:nth-child(3)',

  // Blitz
  '3m': '#board-layout-sidebar > div > div.tab-container-component.tab-content-component > div > div.new-game-index-content > div.create-game-component > div:nth-child(1) > div > div:nth-child(3) > div.time-selector-field-component > button:nth-child(1)',
  '3m+2': '#board-layout-sidebar > div > div.tab-container-component.tab-content-component > div > div.new-game-index-content > div.create-game-component > div:nth-child(1) > div > div:nth-child(3) > div.time-selector-field-component > button:nth-child(2)',
  '5m': '#board-layout-sidebar > div > div.tab-container-component.tab-content-component > div > div.new-game-index-content > div.create-game-component > div:nth-child(1) > div > div:nth-child(3) > div.time-selector-field-component > button:nth-child(3)',

  // Rapid
  '10m': '#board-layout-sidebar > div > div.tab-container-component.tab-content-component > div > div.new-game-index-content > div.create-game-component > div:nth-child(1) > div > div:nth-child(4) > div.time-selector-field-component > button:nth-child(1)',
  '15m+10': '#board-layout-sidebar > div > div.tab-container-component.tab-content-component > div > div.new-game-index-content > div.create-game-component > div:nth-child(1) > div > div:nth-child(4) > div.time-selector-field-component > button:nth-child(2)',
  '30m': '#board-layout-sidebar > div > div.tab-container-component.tab-content-component > div > div.new-game-index-content > div.create-game-component > div:nth-child(1) > div > div:nth-child(4) > div.time-selector-field-component > button:nth-child(3)',

  // Daily
  '1d': '#board-layout-sidebar > div > div.tab-container-component.tab-content-component > div > div.new-game-index-content > div.create-game-component > div:nth-child(1) > div > div:nth-child(5) > div.time-selector-field-component > button:nth-child(1)',
  '3d': '#board-layout-sidebar > div > div.tab-container-component.tab-content-component > div > div.new-game-index-content > div.create-game-component > div:nth-child(1) > div > div:nth-child(5) > div.time-selector-field-component > button:nth-child(2)',
  '7d': '#board-layout-sidebar > div > div.tab-container-component.tab-content-component > div > div.new-game-index-content > div.create-game-component > div:nth-child(1) > div > div:nth-child(5) > div.time-selector-field-component > button:nth-child(3)',
};

const makeMove = async (page,startSquare, endSquare) => {
  //StartSquare = "e2",EndSquare "e4"
  startSquare = (startSquare.charCodeAt(0) - 96).toString() + startSquare[1];
  endSquare = (endSquare.charCodeAt(0) - 96).toString() + endSquare[1];
  //startSquare = "42", EndSquare "44"
  const startSquareElementSelector = `.square-${startSquare}`;
  const endSquareElementSelector = `.square-${endSquare}`;
  await awaitAndClick(page, startSquareElementSelector);
  await awaitAndClick(page, endSquareElementSelector);
}

const converToSq = async(coord) => {
  const file = coord.charCodeAt(0) - 'a'.charCodeAt(0) + 1; // 'a' to 'h' -> 1 to 8
  const rank = parseInt(coord.charAt(1), 10); // Rank '1' to '8' -> 1 to 8
  return (rank - 1) * 8 + file;
}

function parseMove(fen, side, move, inSquare=false) {
  // Ensure the FEN string includes all necessary fields
  fen = fen.split("/").reverse().join("/");;

  fen += ` ${side} KQkq - 0 1`;

  // Initialize the chess board with the given FEN
  const chess = new Chess(fen);

  // Parse and make the move
  const moveObj = chess.move(move, { sloppy: true });

  if (!moveObj) {
      return null;
  }
  const newFEN = moveObj.after;

  // Retrieve the piece type, start square, and end square
  if (!inSquare){
      const startSquare = moveObj.from;
      const endSquare = moveObj.to;
      return {startSquare, endSquare, newFEN };
  }
  const startSquare = converToSq(moveObj.from);
  const endSquare = converToSq(moveObj.to);
  return {startSquare, endSquare, newFEN };

}


async function GetSide(page) {
// Wait for the element to appear in the DOM
await page.waitForSelector('.clock-bottom');
// Retrieve the element handle
return await page.evaluate(() => {
      const bottom_clock_element = document.querySelector('.clock-bottom').classList;
      color = bottom_clock_element[2]
      alert(color)
      return color[6];
  });

}
const getCurrentHtmlBoard = async (page) => {
  await page.waitForSelector("#board-single");
  await page.waitForSelector("#board-single > svg.coordinates > text:nth-child(8)");

  return await page.evaluate(() => {
    return document.getElementById("board-single").innerHTML;
  });
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
const movePopUp = async (page) => {
  
  return await page.evaluate(() => {
    return new Promise((resolve) => {
      Swal.fire({
        title: 'Enter Move',
        input: 'text',
        showCancelButton: true,
        confirmButtonText: 'Submit',
        position: 'top',  // Position the prompt at the left
        preConfirm: (value) => {
          return value;
        }
      }).then((result) => {
        resolve(result.value);     
        });
    });
  });
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--window-size=1100,800'],
    executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 900 });
  await page.goto('https://www.chess.com/login_and_go?returnUrl=https://www.chess.com/');
  await page.waitForSelector('body'); // Wait for the body to be available for interaction
  

  await awaitAndType(page, emailInputSelector, EMAIL);
  await awaitAndType(page, passwordInputSelector, PASSWORD);
  await awaitAndClick(page, nextBtnSelector);
  await clickIfExists(page, exitSuggestionBtnSelector);

  await awaitAndClick(page, newGameBtnSelector);
  const TimeControl = await page.evaluate(() => {
    return prompt('Please enter Time Control (1m, 1m+1, 2m+1, | 3m, 3m+2, 5m | 10m, 15m+10, 30m):');
  });

  await awaitAndClick(page, timeControlBtnSelector);
  await awaitAndClick(page, timeBtnSelectors[TimeControl]);
  await awaitAndClick(page, playBtnSelector)
  await page.waitForFunction('window.location.href.includes("https://www.chess.com/game")'); // Replace "newPage" with part of the new URL
  const htmlBoard = await getCurrentHtmlBoard(page);
  const listBoard = htmlBoardToColumnBListBoard(htmlBoard);
  const ChessBoard = columnBListBoardToRowBoard(listBoard);
  let FEN = chessBoardToFEN(ChessBoard);
  const side = await GetSide(page);
  console.log("old FEN:", FEN);
  console.log("Side:", side);

  // Add SweetAlert2 to the page
  await page.addScriptTag({ path: require.resolve('sweetalert2') });
  const move = await movePopUp(page);
  console.log("Move:", move);
  try {
    const { startSquare, endSquare, newFEN } = await parseMove(FEN, side, move); 
    FEN = newFEN;
    console.log("FEN:", FEN)
    makeMove(page, startSquare, endSquare)     
  }
  catch (error) {
    page.evaluate(() => {
      alert('Invalid move. Please try again.');
    })
  }
  
  
})();
