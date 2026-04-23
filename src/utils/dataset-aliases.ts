export const DATASET_ALIASES: Record<string, string[]> = {
  "imagenet": ["ILSVRC", "ImageNet-1K", "ImageNet Large Scale Visual Recognition Challenge"],
  "coco": ["MS COCO", "Microsoft COCO", "Common Objects in Context"],
  "squad": ["SQuAD", "Stanford Question Answering Dataset"],
  "squad-v2": ["SQuAD 2.0", "SQuAD v2"],
  "cifar-10": ["CIFAR10", "CIFAR 10"],
  "cifar-100": ["CIFAR100", "CIFAR 100"],
  "mnist": ["MNIST handwritten digits"],
  "fashion-mnist": ["Fashion MNIST", "FashionMNIST"],
  "glue": ["GLUE Benchmark", "General Language Understanding Evaluation"],
  "superglue": ["SuperGLUE"],
  "wikitext": ["WikiText-2", "WikiText-103"],
  "imdb": ["IMDB Movie Reviews", "IMDb"],
  "yelp": ["Yelp Reviews", "Yelp Dataset"],
  "amazon-reviews": ["Amazon Reviews", "Amazon Product Reviews"],
  "common-crawl": ["CommonCrawl", "Common Crawl"],
  "c4": ["Colossal Clean Crawled Corpus"],
  "the-pile": ["The Pile", "EleutherAI Pile"],
  "laion": ["LAION-5B", "LAION-400M", "LAION"],
  "openwebtext": ["OpenWebText", "OpenWebText2"],
  "voc": ["Pascal VOC", "PASCAL VOC 2007", "PASCAL VOC 2012"],
  "cityscapes": ["Cityscapes"],
  "ade20k": ["ADE20K", "MIT Scene Parsing"],
  "kitti": ["KITTI", "KITTI Vision Benchmark"],
  "nyu-depth": ["NYU Depth V2", "NYUv2"],
  "celeba": ["CelebA", "CelebFaces", "Large-scale CelebFaces Attributes"],
  "lfw": ["Labeled Faces in the Wild", "LFW"],
  "wmt": ["WMT Translation", "Workshop on Machine Translation"],
  "conll": ["CoNLL-2003", "CoNLL"],
  "snli": ["Stanford Natural Language Inference", "SNLI"],
  "mnli": ["Multi-Genre NLI", "MultiNLI", "MNLI"],
  "sst": ["Stanford Sentiment Treebank", "SST-2", "SST-5"],
  "mrpc": ["Microsoft Research Paraphrase Corpus", "MRPC"],
  "qnli": ["Question NLI", "QNLI"],
  "rte": ["Recognizing Textual Entailment", "RTE"],
  "wnli": ["Winograd NLI", "WNLI"],
  "cola": ["Corpus of Linguistic Acceptability", "CoLA"],
  "ag-news": ["AG News", "AG's News Corpus"],
  "dbpedia": ["DBpedia", "DBpedia Ontology"],
  "yahoo-answers": ["Yahoo Answers", "Yahoo! Answers"],
  "20newsgroups": ["20 Newsgroups", "Twenty Newsgroups"],
  "reuters": ["Reuters-21578", "RCV1"],
  "svhn": ["Street View House Numbers", "SVHN"],
  "stl-10": ["STL-10"],
  "places": ["Places365", "Places205", "MIT Places"],
  "sun": ["SUN Database", "SUN397"],
  "caltech": ["Caltech-101", "Caltech-256"],
  "oxford-pets": ["Oxford-IIIT Pet", "Oxford Pets"],
  "oxford-flowers": ["Oxford Flowers 102", "Oxford 102 Flowers"],
  "food-101": ["Food-101"],
  "stanford-cars": ["Stanford Cars"],
  "fgvc-aircraft": ["FGVC Aircraft", "FGVC-Aircraft"],
  "dtd": ["Describable Textures Dataset", "DTD"],
  "eurosat": ["EuroSAT"],
  "ucf-101": ["UCF101", "UCF-101"],
  "kinetics": ["Kinetics-400", "Kinetics-600", "Kinetics-700"],
  "hmdb51": ["HMDB-51"],
  "something-something": ["Something-Something V2", "SSv2"],
  "cub-200": ["CUB-200-2011", "Caltech-UCSD Birds"],
  "shapenet": ["ShapeNet", "ShapeNetCore"],
  "modelnet": ["ModelNet40", "ModelNet10"],
  "scannet": ["ScanNet"],
  "nuscenes": ["nuScenes"],
  "waymo": ["Waymo Open Dataset"],
  "argoverse": ["Argoverse"],
  "bdd100k": ["BDD100K", "Berkeley DeepDrive"],
  "visual-genome": ["Visual Genome"],
  "gqa": ["GQA", "Visual Reasoning"],
  "vqa": ["Visual Question Answering", "VQA v2"],
  "clevr": ["CLEVR"],
  "nlvr": ["NLVR2", "Natural Language Visual Reasoning"],
  "flickr30k": ["Flickr30K", "Flickr 30K Entities"],
  "mscoco-captions": ["COCO Captions", "MS COCO Captions"],
  "conceptual-captions": ["Conceptual Captions", "CC3M", "CC12M"],
  "sbu-captions": ["SBU Captions"],
  "librispeech": ["LibriSpeech"],
  "common-voice": ["Mozilla Common Voice", "Common Voice"],
  "voxceleb": ["VoxCeleb", "VoxCeleb2"],
  "libritts": ["LibriTTS"],
  "ljspeech": ["LJ Speech", "LJSpeech"],
  "audioset": ["AudioSet"],
  "freebase": ["Freebase", "FB15K"],
  "wn18": ["WN18", "WordNet-18"],
  "fb15k-237": ["FB15K-237"],
  "ogb": ["Open Graph Benchmark", "OGB"],
  "pubmed": ["PubMed", "PubMed Central"],
  "mimic": ["MIMIC-III", "MIMIC-IV", "MIMIC-CXR"],
  "chestxray": ["ChestX-ray14", "CheXpert", "NIH Chest X-ray"],
  "isic": ["ISIC Skin Lesion", "ISIC 2018", "ISIC 2019"],
  "camelyon": ["Camelyon16", "Camelyon17"],
  "luna16": ["LUNA16"],
  "brats": ["BraTS", "Brain Tumor Segmentation"],
  "lvis": ["LVIS"],
  "open-images": ["Open Images", "Open Images V6", "Open Images V7"],
  "objects365": ["Objects365"],
  "wider-face": ["WIDER Face", "WiderFace"],
  "fddb": ["FDDB", "Face Detection Data Set and Benchmark"],
  "wflw": ["WFLW"],
  "300w": ["300W", "300 Faces in the Wild"],
  "alpaca": ["Stanford Alpaca"],
  "dolly": ["Databricks Dolly"],
  "oasst": ["OpenAssistant", "OASST1"],
  "sharegpt": ["ShareGPT"],
  "natural-questions": ["Natural Questions", "NQ"],
  "triviaqa": ["TriviaQA"],
  "hotpotqa": ["HotpotQA"],
  "drop": ["DROP"],
  "race": ["RACE"],
  "quac": ["QuAC"],
  "coqa": ["CoQA"],
  "narrativeqa": ["NarrativeQA"],
  "msmarco": ["MS MARCO", "Microsoft Machine Reading Comprehension"],
  "trec": ["TREC"],
  "beir": ["BEIR"],
  "mteb": ["MTEB", "Massive Text Embedding Benchmark"],
  "humaneval": ["HumanEval"],
  "mbpp": ["MBPP", "Mostly Basic Python Problems"],
  "apps": ["APPS"],
  "gsm8k": ["GSM8K", "Grade School Math 8K"],
  "math": ["MATH dataset"],
  "mmlu": ["MMLU", "Massive Multitask Language Understanding"],
  "hellaswag": ["HellaSwag"],
  "winogrande": ["WinoGrande"],
  "arc": ["AI2 Reasoning Challenge", "ARC"],
  "piqa": ["PIQA", "Physical Intuition QA"],
  "boolq": ["BoolQ"],
  "truthfulqa": ["TruthfulQA"],
  "bigbench": ["BIG-Bench", "BIG-bench Hard", "BBH"],
};

const reverseIndex = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(DATASET_ALIASES)) {
  reverseIndex.set(canonical.toLowerCase().replace(/[\s\-_]/g, ""), canonical);
  for (const alias of aliases) {
    reverseIndex.set(alias.toLowerCase().replace(/[\s\-_]/g, ""), canonical);
  }
}

export function getSearchVariants(name: string): string[] {
  const normalized = name.toLowerCase().replace(/[\s\-_]/g, "");
  const canonical = reverseIndex.get(normalized);
  if (canonical) {
    return [canonical, ...(DATASET_ALIASES[canonical] ?? [])];
  }

  for (const [key, aliases] of Object.entries(DATASET_ALIASES)) {
    if (key.includes(normalized) || normalized.includes(key.replace(/[\s\-_]/g, ""))) {
      return [key, ...aliases];
    }
    for (const alias of aliases) {
      const aliasNorm = alias.toLowerCase().replace(/[\s\-_]/g, "");
      if (aliasNorm.includes(normalized) || normalized.includes(aliasNorm)) {
        return [key, ...aliases];
      }
    }
  }

  return [name];
}

export function getCanonicalName(name: string): string | undefined {
  const normalized = name.toLowerCase().replace(/[\s\-_]/g, "");
  return reverseIndex.get(normalized);
}
