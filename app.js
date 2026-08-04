const express = require('express');
const cors = require('cors');
const multer = require('multer');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const app = express();
app.use(cors());

// Serve a interface web (public/index.html) na raiz da aplicacao
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ dest: os.tmpdir() });

app.post('/api/extrair-tabela', upload.single('arquivo'), (req, res) => {
    if (!req.file) return res.status(400).send('Envie um PDF.');

    const filePath = req.file.path; 
    const jarPath = path.join(__dirname, 'tabula-1.0.5-jar-with-dependencies.jar'); 

    const comando = `java -Dfile.encoding=utf-8 -jar "${jarPath}" -p all -t -f TSV "${filePath}"`;

    exec(comando, { maxBuffer: 1024 * 1024 * 50, encoding: 'utf8' }, async (err, stdout, stderr) => {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        if (err) return res.status(500).send('Falha ao processar com Java.');
        if (!stdout || stdout.trim() === '') return res.status(404).send('Nenhuma tabela encontrada.');

        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Leituras');

            const azulClaro = 'FFDEE6F0'; 
            const azulBorda = 'FFB4C6E7';

            worksheet.columns = [
                { key: 'apto', width: 12 },
                { key: 'leitura_ant', width: 22 },
                { key: 'leitura_atu', width: 22 },
                { key: 'consumo', width: 15 },
                { key: 'valor', width: 20 },
                { key: 'media', width: 15 }
            ];

            let tituloCondominio = "Relatório de Medição";
            let rgi = "";
            let subtitulo = "Leitura dos medidores para apuração do consumo individual";

            const matchRGI = stdout.match(/RGI\s*:\s*(\d+)/i);
            if (matchRGI) rgi = `RGI: ${matchRGI[1]}`;

            const textoSemRGI = stdout.replace(/RGI.*/ig, '');
            const matchCond = textoSemRGI.match(/([A-ZÀ-Ú\s]+(?:MILAS|CONDOM[ÍI]NIO|RESIDENCIAL|EDIF[ÍI]CIO)[A-ZÀ-Ú\s]*)/i);
            if (matchCond) {
                tituloCondominio = matchCond[1].trim();
            }

            const matchSubtitulo = stdout.match(/([L]?eitura dos medidores[^\n\r]+)/i);
            if (matchSubtitulo) {
                subtitulo = matchSubtitulo[1].trim();
                if (subtitulo.toLowerCase().startsWith('eitura')) {
                    subtitulo = 'L' + subtitulo.substring(1); 
                }
            }

            // Pinta o fundo da Coluna A (onde vai a logo) para criar a barra unificada
            worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
            worksheet.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };

            // TÍTULO: Mescla a partir da Coluna B até a F
            worksheet.mergeCells('B1:F1');
            const tituloCell = worksheet.getCell('B1');
            tituloCell.value = rgi ? `${tituloCondominio}  -  ${rgi}` : tituloCondominio;
            tituloCell.font = { bold: true, size: 14, color: { argb: 'FF000000' } };
            tituloCell.alignment = { vertical: 'middle', horizontal: 'center' };
            tituloCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
            worksheet.getRow(1).height = 30;

            // SUBTÍTULO: Mescla a partir da Coluna B até a F
            worksheet.mergeCells('B2:F2');
            const subtituloCell = worksheet.getCell('B2');
            subtituloCell.value = subtitulo;
            subtituloCell.font = { italic: true, size: 11, color: { argb: 'FF333333' } };
            subtituloCell.alignment = { vertical: 'middle', horizontal: 'center' };
            subtituloCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
            worksheet.getRow(2).height = 20;

            // DOWNLOAD E INJEÇÃO DA LOGO
            try {
                const logoUrl = 'https://cstnoxbswjdrslaqzriy.supabase.co/storage/v1/object/public/hidrotech/logo/LOGO_HIDROTECH_MEDICAO_SOLIDO_AZUL.png';
                const logoResponse = await fetch(logoUrl);
                const arrayBuffer = await logoResponse.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                
                const logoId = workbook.addImage({
                    buffer: buffer,
                    extension: 'png',
                });

                // Injeta a logo bem alinhada no canto esquerdo da Coluna A
                worksheet.addImage(logoId, {
                    tl: { col: 0.1, row: 0.1 }, 
                    ext: { width: 135, height: 45 } 
                });
            } catch (imgErr) {
                console.error('Erro ao injetar a logo:', imgErr);
            }

            worksheet.addRow([]);

            // EXTRAÇÃO DAS DATAS E CABEÇALHO DA TABELA
            let dataAnterior = "", dataAtual = "";
            const matchAnterior = stdout.match(/Anterior[\s\S]{0,300}?(\d{2}\/\d{2}\/\d{4})/i);
            const matchAtual = stdout.match(/Atual[\s\S]{0,300}?(\d{2}\/\d{2}\/\d{4})/i);

            if (matchAnterior && matchAtual) {
                dataAnterior = `\n(${matchAnterior[1]})`;
                dataAtual = `\n(${matchAtual[1]})`;
            } else {
                const todasAsDatas = stdout.match(/\d{2}\/\d{2}\/\d{4}/g);
                if (todasAsDatas && todasAsDatas.length >= 2) {
                    dataAnterior = `\n(${todasAsDatas[0]})`;
                    dataAtual = `\n(${todasAsDatas[1]})`;
                }
            }

            const linhaCabecalho = worksheet.addRow([
                'Apto.', `Leitura Anterior${dataAnterior}`, `Leitura Atual${dataAtual}`, 'Consumo (m³)', 'Valor Individual', 'Média'
            ]);
            linhaCabecalho.height = 30;
            
            linhaCabecalho.eachCell((cell) => {
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.font = { bold: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: azulClaro } };
                cell.border = {
                    top: { style: 'thin', color: {argb: azulBorda} }, left: { style: 'thin', color: {argb: azulBorda} },
                    bottom: { style: 'thin', color: {argb: azulBorda} }, right: { style: 'thin', color: {argb: azulBorda} }
                };
            });

            // CORPO DA TABELA E SEGREGAÇÃO DO RODAPÉ
            const linhas = stdout.split('\n');
            const linhasRodape = [];
            let isRodape = false;
            
            linhas.forEach((linhaTsv) => {
                let limpo = linhaTsv.trim();
                if (!limpo) return;
                limpo = limpo.replace(/"/g, '');

                if (limpo.toLowerCase().includes('consumo total individual') || limpo.toLowerCase().includes('observaç')) {
                    isRodape = true;
                }

                if (isRodape) {
                    linhasRodape.push(limpo);
                    return; 
                }

                const primeiroBloco = limpo.split(/[\t ]+/)[0];

                if (/^\d+$/.test(primeiroBloco) && primeiroBloco.length <= 4) {
                    let colunas = limpo.split('\t').map(c => c.trim()).filter(c => c !== '');

                    if (colunas.length < 6) {
                        let texto = colunas.join(' ');
                        texto = texto.replace(/R\$\s+/g, 'R$');
                        let quebradas = texto.split(/\s+/);
                        colunas = quebradas.map(c => c.startsWith('R$') ? c.replace('R$', 'R$ ') : c);
                    }

                    if (colunas.length >= 5) {
                        const novaLinha = worksheet.addRow(colunas.slice(0, 6));
                        
                        novaLinha.eachCell((cell, colNumber) => {
                            cell.alignment = { vertical: 'middle', horizontal: 'center' };
                            cell.border = {
                                top: { style: 'thin', color: {argb: azulBorda} }, left: { style: 'thin', color: {argb: azulBorda} },
                                bottom: { style: 'thin', color: {argb: azulBorda} }, right: { style: 'thin', color: {argb: azulBorda} }
                            };
                            if (colNumber === 1 || colNumber === 5) {
                                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: azulClaro } };
                            }
                        });
                    }
                }
            });

            // INSERÇÃO E ESTILIZAÇÃO DO RODAPÉ
            if (linhasRodape.length > 0) {
                linhasRodape.forEach(textoRodape => {
                    if (/consumo/i.test(textoRodape) && !textoRodape.toLowerCase().includes('unidades')) {
                        let partes = textoRodape.split('\t').map(p => p.trim()).filter(p => p !== '');

                        if (partes.length < 4) {
                            const match = textoRodape.match(/^(.*?consumo.*?)\s+(\d+.*)$/i);
                            if (match) {
                                let label = match[1].trim();
                                let nums = match[2].replace(/R\$\s+/g, 'R$').split(/\s+/).map(c => c.startsWith('R$') ? c.replace('R$', 'R$ ') : c);
                                partes = [label, ...nums];
                            }
                        }

                        let novaLinha = worksheet.addRow([
                            partes[0] || textoRodape, '', '', partes[1] || '', partes[2] || '', partes[3] || ''
                        ]);

                        worksheet.mergeCells(`A${novaLinha.number}:C${novaLinha.number}`);
                        novaLinha.font = { bold: true };
                        
                        [1, 4, 5, 6].forEach(colIndex => {
                            let cell = novaLinha.getCell(colIndex);
                            cell.border = {
                                top: { style: 'thin', color: {argb: azulBorda} }, left: { style: 'thin', color: {argb: azulBorda} },
                                bottom: { style: 'thin', color: {argb: azulBorda} }, right: { style: 'thin', color: {argb: azulBorda} }
                            };
                            cell.alignment = { vertical: 'middle', horizontal: 'center' };
                            
                            if (colIndex === 1) cell.alignment = { vertical: 'middle', horizontal: 'left' }; 
                            if (colIndex === 1 || colIndex === 5) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: azulClaro } };
                        });

                    } else if (textoRodape.trim() !== '') {
                        const rowAdded = worksheet.addRow([textoRodape]);
                        worksheet.mergeCells(`A${rowAdded.number}:F${rowAdded.number}`);
                        rowAdded.getCell(1).alignment = { wrapText: true, horizontal: 'left', vertical: 'middle' };

                        if (/vencimento/i.test(textoRodape)) {
                            rowAdded.font = { bold: true, size: 12 };
                            rowAdded.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
                            rowAdded.height = 30;
                        }
                    }
                });
            }

            // DOWNLOAD
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="relatorio_final.xlsx"');

            await workbook.xlsx.write(res);
            res.end();

        } catch (excelErr) {
            console.error(excelErr);
            res.status(500).send('Erro ao formatar o Excel.');
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));