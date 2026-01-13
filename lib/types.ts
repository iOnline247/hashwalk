export interface ChecksumRow {
  RelativePath: string;
  FileName: string;
  Algorithm: string;
  Hash: string;
}

export interface HashWalkResult { 
  csv: string; 
  hash: string; 
  compare?: boolean 
}
