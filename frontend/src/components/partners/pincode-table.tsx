"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  MapPin,
} from "lucide-react";

interface PincodeType {
  id: string;
  name: string;
  type: "yes_no" | "number";
  isActive: boolean;
}

interface PartnerPincode {
  id: string;
  partnerId: string;
  pincodeId: string;
  pincodeCode: string;
  city: string | null;
  state: string | null;
  typeValues: Record<string, string>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PincodeTableProps {
  pincodes: PartnerPincode[];
  pincodeTypes: PincodeType[];
  onEdit: (pincode: PartnerPincode) => void;
  onDelete: (pincodeId: string) => void;
}

export function PincodeTable({
  pincodes,
  pincodeTypes,
  onEdit,
  onDelete,
}: PincodeTableProps) {
  // Show all pincode types (backend handles filtering)
  const activePincodeTypes = pincodeTypes;

  // Render pincode type value
  const renderTypeValue = (value: string, type: string) => {
    // Use default values if not set
    const displayValue = value || (type === "yes_no" ? "no" : "0");

    if (type === "yes_no") {
      return (
        <Badge
          variant={
            displayValue.toLowerCase() === "yes" ? "default" : "secondary"
          }
          className={
            displayValue.toLowerCase() === "yes"
              ? "bg-green-50 text-green-700"
              : "bg-gray-50 text-gray-700"
          }
        >
          {displayValue === "yes" ? "Yes" : "No"}
        </Badge>
      );
    }

    return <span className="font-mono">{displayValue}</span>;
  };

  if (pincodes.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-muted/20">
        <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-lg font-semibold mb-1">No Pincodes Assigned</h3>
        <p className="text-sm text-muted-foreground">
          Start by assigning pincodes to this partner using the "Assign Pincode"
          button above.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Pincode</TableHead>
            {activePincodeTypes.map((pt) => (
              <TableHead key={pt.id} className="capitalize min-w-[100px]">
                {pt.name}
              </TableHead>
            ))}
            <TableHead className="w-[80px]">Status</TableHead>
            <TableHead className="w-[60px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pincodes.map((pincode) => (
            <TableRow key={pincode.id}>
              <TableCell className="font-mono font-medium">
                {pincode.pincodeCode}
              </TableCell>
              {activePincodeTypes.map((pt) => (
                <TableCell key={pt.id}>
                  {renderTypeValue(pincode.typeValues[pt.name], pt.type)}
                </TableCell>
              ))}
              <TableCell>
                {pincode.isActive ? (
                  <Badge className="bg-green-50 text-green-700">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Active
                  </Badge>
                ) : (
                  <Badge className="bg-gray-50 text-gray-700">
                    <XCircle className="mr-1 h-3 w-3" />
                    Inactive
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                    >
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(pincode)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => onDelete(pincode.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
