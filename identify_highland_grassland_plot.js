/**
* @description
*    Identify highland grassland - Based on DEM
* 
* @author 
*    Grazieli Rodigheri - 2024/12
*/ 

// ===============================
//     SELECIONA A ESTEPE
// ===============================
// Limites de estepe
var estepe_MA_250 = ee.FeatureCollection("projects/ee-evelezmartin/assets/estepes_refugios1-250m")
var estepe_MA_5M = ee.FeatureCollection("projects/ee-evelezmartin/assets/estepes_refugios1-5M")

// ----- SELECIONA O SHAPE DE ESTEPE AQUI -------
var estepe = estepe_MA_250 // mudar para 250 ou 5M
var name_est = "250"  // conforme o shape escolhido acima (250 ou 5M)

// ==============================
//     CARREGA OS DE ASSETS
// ==============================
// Limite do biomas do Brasil
var biomas = ee.FeatureCollection('projects/mapbiomas-workspace/AUXILIAR/biomas_IBGE_250mil')
var bioma = biomas.filter(ee.Filter.eq('Bioma','Mata Atlântica'))
var biome = "MA"

// Estados da MA
var estados_leiMA = ee.FeatureCollection("projects/ee-evelezmartin/assets/estados_leiMA")

// Modelo Digital de Elevação (MDE) - Opções
// NASA SRTM Digital Elevation 30m:
var mde_nasa = ee.Image('USGS/SRTMGL1_003')
var elevation_nasa = mde_nasa.select('elevation')

// Classificação col 9
var col9 = ee.Image('projects/mapbiomas-public/assets/brazil/lulc/collection9/mapbiomas_collection90_integration_v1')

// =================================
//   PRÉ-PROCESSA OS ASSETS
// =================================
// Cria a máscara da estepe
var mask_estepe = ee.Image().paint(estepe).eq(0)
var line_estepe = ee.Image().paint(estepe,'vazio', 3).eq(0)

// Cria a máscara do bioma
var mask_bioma = ee.Image().paint(estados_leiMA).eq(0)
var line_bioma = ee.Image().paint(estados_leiMA,'vazio', 3).eq(0)
Map.centerObject(estados_leiMA, 4)

// Seleciona o MDE de análise
var elevacao = elevation_nasa
  .clip(BR_shape)
Map.addLayer(elevacao, {min: 0, max: 1500, 'palette':['cyan', 'blue', 'green', 'orange', 'brown']}, 'Elevação', false);

// Cria uma máscara de campos da col9
var mask_campo_col9 = col9
  .select("classification_2023")
  .eq(12).selfMask()
Map.addLayer(mask_campo_col9, {min: 0, max: 1, 'palette':['white', 'orange']}, 'Campos - Col9', false);

// =================================
// SELEÇÃO DE CAMPOS A. NO BRASIL
// =================================
// Parêmtros de visualização de elevação e de faixas
var pall_mde = {'min':0, 'max':1300, 'palette':['white', 'blue', 'green', 'orange', 'brown']};
var pall_faixas = {'min':0, 'max':3, 'palette':['white', '#A0522D', '#D2691E', '#F4A460']}
var pall_classes = {'min':0, 'max':4, 'palette':["white", '#FFE5B3', '#9ACD32', 'orange', '#aa2b0c']}

// Adicionar uma banda de latitude à imagem
var latitude = ee.Image.pixelLonLat().select('latitude');

// Filtrar por faixas de latitude e elevação
var faixa1 = latitude.gt(-16).and(latitude.lte(5)).and(elevacao.gt(600)); // 5°N a 16°S, >600m
var faixa2 = latitude.gt(-24).and(latitude.lte(-16)).and(elevacao.gt(500)); // 16°S a 24°S, >500m
var faixa3 = latitude.lte(-24).and(elevacao.gt(400)); // Acima de 24°S, >400m
// Combinar faixas
var all_faixas = ee.Image(1).updateMask(faixa1)
  .blend(ee.Image(2).updateMask(faixa2))
  .blend(ee.Image(3).updateMask(faixa3))
  .unmask(0);

// Filtrar por faixas de latitude e elevação
var campo1 = elevacao.updateMask(faixa1); // 5°N a 16°S, >600m
var campo2 = elevacao.updateMask(faixa2); // 16°S a 24°S, >500m
var campo3 = elevacao.updateMask(faixa3); // Acima de 24°S, >400m
// Combinar as faixas - visualizar todas as altitudes selecionadas
var campos_altitude = campo1.blend(campo2).blend(campo3).unmask(0);

// =================================
//        CAMPOS A. NO BIOMA
// =================================
// Seleciona faixas CA da vegetação na MA
var all_faixas_bioma = all_faixas.mask(mask_bioma);
Map.addLayer(all_faixas_bioma, pall_faixas, 'Zonas CA - '+biome, false);

// Seleciona elevações da vegetação estepe
var campos_altitude_bioma = campos_altitude.mask(mask_bioma);
Map.addLayer(campos_altitude_bioma, pall_mde, 'Campos Altitude - '+biome, false);

// =================================
//      ESTEPE NO BIOMA
// =================================
// Seleciona elevações da vegetação estepe
var estepe_bioma = mask_estepe.updateMask(mask_bioma)
Map.addLayer(estepe_bioma, {'min':1, 'max':1, 'palette':['orange']}, 'Estepe - '+biome, false);

// =================================
//  CAMPOS A. INTERSECT MA e ESTEPE
// =================================
// Seleciona faixas CA da vegetação estepe no bioma
var faixas_estepe_bioma = all_faixas_bioma.updateMask(mask_estepe).unmask(0);
Map.addLayer(faixas_estepe_bioma, pall_faixas, 'Zonas CA - Estepe - '+biome, false);

// Seleciona elevações da vegetação estepe dentro do bioma
var elevacao_estepe_bioma = campos_altitude_bioma.updateMask(mask_estepe).unmask(0);
Map.addLayer(elevacao_estepe_bioma, pall_mde, 'Campos Altitude - Estepe - '+biome, false);

// =================================
//        CLASSES NO BIOMA
// =================================
// Tiff final com todas as classes e intersecções
var ca_classes = ee.Image(1).updateMask(mask_bioma)
  .blend(ee.Image(2).updateMask(campos_altitude_bioma))
  .blend(ee.Image(3).updateMask(estepe_bioma))
  .blend(ee.Image(4).updateMask(elevacao_estepe_bioma))
Map.addLayer(ca_classes, pall_classes, 'Classes CA - '+biome, false);


// =================================
//    CLASSES NO BIOMA NA COL9
// =================================
// Seleciona elevações CA dentro do bioma que foram 12 na col9
var ca_classes_col9 = ca_classes.updateMask(mask_campo_col9).unmask(0)//mask(mask_bioma)
Map.addLayer(ca_classes_col9, pall_classes, 'Classes CA na Col9 - '+biome, false);

// Plota limites no mapa
var visPar = {'palette':'000000','opacity': 1}
Map.addLayer(line_bioma, visPar, 'Bioma', false);
Map.addLayer(line_estepe, visPar, 'Estepe '+name_est, false);



// ============================
//     EXPORT TIFFS
// ============================

// Função para exportar os tifs
var exporttifgdrive = function (image, name, geom) {
  // Defina os parâmetros de exportação
  return Export.image.toDrive({
            image: image,                 // A imagem a ser exportada
            folder: 'GEE_TIFS',
            description: name,       // Nome do arquivo de exportação
            fileNamePrefix: name,    // Prefixo do nome do arquivo
            region: geom,           // Região a ser exportada
            scale: 30,                       // Escala em metros por pixel
            crs: 'EPSG:4326',                // Sistema de referência de coordenadas (CRS)
            maxPixels: 1e13,
            fileFormat: 'GeoTIFF',           // Formato do arquivo de exportação
            formatOptions: {
              cloudOptimized: true          // Exportar como TIFF otimizado para nuvem (opcional)
            }
          });
}

// exporttifgdrive(campos_altitude_bioma, "campos_altitude_"+biome, bioma.geometry().bounds())
// exporttifgdrive(all_faixas_bioma, "zonas_campos_altitude_"+biome, bioma.geometry().bounds())
// exporttifgdrive(estepe_bioma, "estepe_"+name_est+"_"+biome, estepe.geometry().bounds())
// exporttifgdrive(elevacao_estepe_bioma, "intersect_ca_estepe_"+name_est+"_"+biome, bioma.geometry().bounds())
// exporttifgdrive(faixas_estepe_bioma, "zonas_intersect_ca_estepe_"+name_est+"_"+biome, bioma.geometry().bounds())

exporttifgdrive(ca_classes, "campos_altitude_estepe_"+name_est+"_"+biome, bioma.geometry().bounds())
exporttifgdrive(ca_classes_col9, "campos_altitude_estepe_"+name_est+"_col9_"+biome, bioma.geometry().bounds())
