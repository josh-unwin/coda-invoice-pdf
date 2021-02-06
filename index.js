/**
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */

const { default: axios } = require('axios');

function generatePdf(docDefinition, callback) {
  try {
    var fonts = {
      Roboto: {
        normal: 'fonts/Inconsolata-Regular.ttf',
        bold: 'fonts/Inconsolata-Bold.ttf'
      }
    };

    var PdfPrinter = require('pdfmake');
    const printer = new PdfPrinter(fonts);
    const doc = printer.createPdfKitDocument(docDefinition);
    
    let chunks = [];

    doc.on('data', (chunk) => {
      chunks.push(chunk);
    });
  
    doc.on('end', () => {
      callback(Buffer.concat(chunks));
    });
    
    doc.end();
    
  } catch(err) {
    throw(err);
  }
};

async function getLineItemsData(codaInvoiceRowId) {
  const richInvoiceData = await axios.get(
      `https://coda.io/apis/v1/docs/_vA8L1464t/tables/grid-QjeyjpqADJ/rows/${codaInvoiceRowId}?valueFormat=rich`, 
      { headers: { Authorization: `Bearer ${process.env.CODA_API_KEY}` }}
    );

  const lineItemIds = richInvoiceData.data.values["c-wDErSNUHhH"].map(lineItem => [lineItem.tableId, lineItem.rowId] )

  const lineItems = await Promise.all(lineItemIds.map(async (lineItemId) => {
    const lineItem = await axios.get(
    `https://coda.io/apis/v1/docs/_vA8L1464t/tables/${lineItemId[0]}/rows/${lineItemId[1]}`,
    { headers: { Authorization: `Bearer ${process.env.CODA_API_KEY}` }});

    return {
      description: lineItem["data"]["values"]["c-lON9r7KWCY"],
      quantity: lineItem["data"]["values"]["c-d-Ap6Ai8tk"],
      rate: lineItem["data"]["values"]["c-_n8K74vQwz"],
      total: lineItem["data"]["values"]["c-7BarwIK037"]
    }
  }));

  return lineItems
}

async function getInvoiceData(codaInvoiceRowId) {
  try {
    const res = await axios.get(
      `https://coda.io/apis/v1/docs/_vA8L1464t/tables/grid-QjeyjpqADJ/rows/${codaInvoiceRowId}`, 
      { headers: { Authorization: `Bearer ${process.env.CODA_API_KEY}` }}
    );
    
    return res.data.values
  }
  catch(err) {
    console.log("An Error occured while fetching the Invoice data: " + err);
    return "An Error occured while fetching the Invoice data: " + err
  }
}

async function getPayeeInfo() {
  try {
    const res = await axios.get(
      `https://coda.io/apis/v1/docs/_vA8L1464t/tables/grid-VlJvrtgK7Q/rows/i-Kwi_nk3-xw`, 
      { headers: { Authorization: `Bearer ${process.env.CODA_API_KEY}` }}
    );

    return res.data.values
  }
  catch(err) {
    console.log("An Error occured while fetching the Invoice data: " + err);
    return "An Error occured while fetching the Invoice data: " + err
  }
}

function makePdfTemplate(invoiceData, lineItemsData, payeeInfo) {
  var moment = require('moment'); // require
  const invoiceName = invoiceData["c-JlGsEx_iDw"]
  const invoiceDate = moment(invoiceData["c-SjcwnH9IeL"]).format('DD/MM/YYYY');
  const subtotal = invoiceData["c-fJIV0aQVpk"]
  const vat = invoiceData["c-fWNVW_8fI9"]
  const total = invoiceData["c-pAZr2nAHAH"]
  const project = invoiceData["c-baog3ln3TV"]
  const clientEmail = invoiceData["c-pnVZrEc79t"]
  const description = invoiceData["c-m0YYVpia4p"]
  const projectCode = invoiceData["c-wOi0A9rzXo"]
  const contactName = payeeInfo["c-W_GP1tCFwr"]
  const contactEmail = payeeInfo["c-kM6ojhPnXo"]
  const contactNumber = payeeInfo["c-t1CJ3DyQrq"]
  const payeeName = payeeInfo["c-JMVThJUSFU"]
  const accountNumber = payeeInfo["c-KhjemaFGJS"]
  const sortCode = payeeInfo["c-EKGH4k2Kap"]
  const vatNumber = payeeInfo["c-iFcVE5Azuv"]

  const mainInvoiceTable = [[{ text: 'Description', style: 'mainTableHeader' }, { text: 'Rate', style: 'mainTableHeader' }, { text: 'Quantity', style: 'mainTableHeader' }, { text: 'Total', style: 'mainTableHeader' }],]
  
  lineItemsData.forEach(lineItem => {
    mainInvoiceTable.push([lineItem.description, lineItem.rate, `${lineItem.quantity}x`, lineItem.total])
  })

  mainInvoiceTable.push([{text: "Sub Total", colSpan: 3, bold: true, alignment: 'right', border: [false, true, false, false] }, "", "", {text: subtotal, border: [false, true, false, false], }])
  mainInvoiceTable.push([{text: "VAT (20%)", colSpan: 3, bold: true, alignment: 'right' }, "", "", vat])
  mainInvoiceTable.push(["", {text: "Total", alignment: 'right', bold: true, colSpan: 2, border: [false, false, false, true]}, '', {text: total, border: [false, false, false, true]}])
  
  return {
    pageSize: 'A4',
    pageMargins: [ 40, 30, 40, 20 ],
    content: [
      // HEADER
      {
        columns: [
          { text: 'Josh Unwin', fontSize: 40, bold: true },
          { text: [{ text: 'INVOICE ', bold:true }, invoiceName, {text: '\nDATE ', bold: true }, invoiceDate], alignment: 'right' },
        ]
      },
      // PROJECT/CLIENT INFO BOX
      {
        margin: [0, 20],
        table: {
          headerRows: 0,
          widths: ['*'],
          body: [
            [{
              fillColor: '#f5f5f5',
              border: [false, false, false, false],
              margin: [20, 20],
              columns: [
                {
                  layout: 'noBorders',
                  table: {
                    body: [
                      [{text: 'Project', bold: true }, project],
                      [{text: 'Reference', bold: true }, projectCode],
                      [{text: 'Summary', bold: true}, description],
                    ]
                  }
                },
                { text: [ {text: 'FAO:\n', bold: true }, clientEmail ]},
              ]
            }]
        ]},
      },
      // LINE ITEMS TABLE
      {
        margin: [20, 0],
        style: 'mainTableStyling',
        layout: { 
          defaultBorder: false, 
          hLineWidth: (i, node) => { return (i === node.table.body.length) ? 3 : 1 },
          hLineColor: (i, node) => { return (i === node.table.body.length) ? "#2b2b2b" : "#ededed" },
          paddingLeft: () => 5,
          paddingRight: () => 5,
          paddingTop: () => 7,
          paddingBottom: () => 7
        },
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto'],
          body: mainInvoiceTable,
        }
      },
      // PAYEE INFO / FOOTER
      {
        style: 'payeeInfoTableStyling',
        layout: 'noBorders',
        fontSize: 10,
        absolutePosition: {x: 40, y: 710},
        layout: { 
          defaultBorder: false, 
          hLineWidth: () => 1,
          hLineColor: () => "#ededed",
          paddingTop: () => 2,
          paddingLeft: () => 0,
          paddingRight: () => 0,
          paddingBottom: () => 2
        },
        table: {
          headerRows: 1,
          widths: ['*', '*', '*'],
          body: [
            [{ text: 'Address', style: 'payeeHeader', border: [false, false, false, true] }, { text: 'Account Details', style: 'payeeHeader', border: [false, false, false, true] }, { text: 'Contact', style: 'payeeHeader', border: [false, false, false, true] }],
            [
              payeeInfo['c-HgbqeaSnVS'],  
              { 
                layout: {
                  defaultBorder: false, 
                  paddingTop: () => 0,
                  paddingLeft: () => 0,
                  paddingRight: () => 0,
                  paddingBottom: () => 0
                },
                table: {
                headerRows: 0,
                widths: [52, '*'],
                body: [
                  [{text: "To be made payable to:", colSpan: 2}, ""],
                  [{text: 'Name', bold: true}, payeeName ],
                  [{text: 'Acc Number', bold: true}, accountNumber ],
                  [{text: 'Sort Code', bold: true}, sortCode ],
                  [{text: 'VAT Number', bold: true}, vatNumber ]
                ]
              }},
              {text: [contactName, '\n', contactNumber, '\n', contactEmail]}],
              [{ text: "Please include invoice number on payment reference where possible.", alignment: 'center', italic: true, colSpan: 3 }, '', '']
          ],
        },
      }
    ],
    styles: {
      tableExample: {
        margin: [0, 5, 0, 20]
      },
      mainTableHeader: {
        bold: true,
      },
      payeeHeader: {
        bold: true,
      }
    },
  }
};

exports.pdfMaker = async (req, res) => {
  require('dotenv').config();
  const codaInvoiceRowId = req.query.row;

  const invoiceData = await getInvoiceData(codaInvoiceRowId);
  const lineItemsData = await getLineItemsData(codaInvoiceRowId);
  const payeeInfo = await getPayeeInfo();

  generatePdf(makePdfTemplate(invoiceData, lineItemsData, payeeInfo), (response) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.send(response); // sends a base64 encoded string to client
  });
};