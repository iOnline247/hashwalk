export interface ChecksumRow {
  RelativePath: string;
  FileName: string;
  Algorithm: string;
  Hash: string;
}

export interface HashWalkResult {
  compare?: string;
  csv: string; 
  hash: string; 
  isMatch?: boolean 
}
